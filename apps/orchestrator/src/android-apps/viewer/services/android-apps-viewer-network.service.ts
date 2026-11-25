import { addAbortListener } from 'node:events';
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import { OperationDeadline } from '../../../common/operation-deadline';
import type { DockerOperationOptions } from '../../../docker/contracts/docker-operation-options';
import { AndroidAppsTcpAdbService } from '../../common/services/android-apps-tcp-adb.service';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import {
  DOCKER_NETWORK_RUNTIME,
  type DockerNetworkRuntimePort,
} from '../../../docker/contracts/docker-network-runtime.port';
import {
  DOCKER_SIDECAR,
  type AdbTargetPreparation,
  type DockerSidecarPort,
} from '../../../docker/contracts/docker-sidecar.port';
import type { ViewerTargetStatus } from '../../../docker/docker.types';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsPolicyGate } from '../../common/services/android-apps-policy-gate.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { runtimeIdentityKey } from '../../common/utils/android-runtime-identity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { isRedroidRuntime } from '@rebroid/android-application-core/redroid-runtime';
import {
  isPreparedViewerTargetExpired,
  selectPreparedViewerTarget,
  type PreparedViewerTargetEntry,
} from '../utils/prepared-viewer-target-reuse';

export class ViewerRuntimeChangedError extends Error {
  constructor() {
    super(
      'Application runtime or network policy changed during viewer preparation.',
    );
  }
}

type ViewerRuntime = AndroidApplication & { containerStartedAt?: string };

export type PreparedViewerTarget = {
  readonly adbHost: string;
  readonly udid: string;
  readonly viewerTarget: ViewerTargetStatus;
  readonly key: string;
};

type TargetPreparation = {
  appId: string;
  controller: AbortController;
  pending: Promise<PreparedViewerTarget>;
  waiters: number;
};

type ObservedAdbTarget = {
  adbHost: string;
  containerStartedAt: string | null;
};

type ProvisionedAdbTarget = ObservedAdbTarget & {
  purpose: AdbTargetPreparation;
  sidecarGeneration: number;
  target: ViewerTargetStatus;
};

type ProvisionedAdbReadiness = ProvisionedAdbTarget & {
  runtime: string;
  expiresAt: number;
};

const provisionedAdbReadinessTtlMs = 10_000;
const targetReadinessTtlMs = 60_000;
const observedTransportTtlMs = 5 * 60_000;
const maxPreparedTargets = 128;
const maxPendingTargets = 64;

const readinessFingerprint = (app: AndroidApplication) =>
  JSON.stringify([runtimeIdentityKey(app), app.networkPolicyRevision]);

@Injectable()
export class AndroidAppsViewerNetworkService {
  private readonly logger = new Logger(AndroidAppsViewerNetworkService.name);
  private readonly networkPreparations = new Map<string, Promise<unknown>>();
  private readonly networkReleases = new Map<string, Promise<unknown>>();
  private readonly adbTargetPreparations = new Map<string, Promise<unknown>>();
  private readonly provisionedTargets = new Map<
    string,
    ProvisionedAdbReadiness
  >();
  private readonly pendingTargets = new Map<string, TargetPreparation>();
  private readonly preparedTargets = new Map<
    string,
    PreparedViewerTargetEntry<PreparedViewerTarget>
  >();

  constructor(
    @Inject(DOCKER_NETWORK_RUNTIME)
    private readonly networks: DockerNetworkRuntimePort,
    @Inject(DOCKER_SIDECAR)
    private readonly sidecar: DockerSidecarPort,
    private readonly tcpAdb: AndroidAppsTcpAdbService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly logs: AndroidAppsLogService,
    private readonly writer: AndroidAppsStateWriter,
    private readonly queries: AndroidAppsQueryService,
    private readonly policyGate: AndroidAppsPolicyGate,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    private readonly features: FeatureFlagsService,
  ) {}

  async observeProvisioningAdbTarget(
    app: AndroidApplication,
    options?: DockerOperationOptions,
  ): Promise<ObservedAdbTarget> {
    const { containerId } = app;
    if (!containerId)
      return { adbHost: app.containerName, containerStartedAt: null };

    const inspect = await this.lifecycle.inspectContainer(containerId, options);
    const ip = inspect.NetworkSettings?.Networks?.[app.networkName]?.IPAddress;
    const containerStartedAt =
      ip && inspect.Id === containerId && inspect.State?.Running
        ? inspect.State.StartedAt || null
        : null;
    return { adbHost: ip || app.containerName, containerStartedAt };
  }

  rememberProvisionedAdb(
    app: AndroidApplication,
    observation: ProvisionedAdbTarget,
  ) {
    this.provisionedTargets.delete(app.id);
    if (
      !app.containerId ||
      !observation.containerStartedAt ||
      !observation.target.configured ||
      !observation.target.connected ||
      this.networkReleases.has(app.id) ||
      observation.sidecarGeneration !== this.sidecar.adbTargetGeneration
    ) {
      return;
    }

    const now = performance.now();
    for (const [id, entry] of this.provisionedTargets) {
      if (
        entry.expiresAt <= now ||
        entry.sidecarGeneration !== observation.sidecarGeneration
      ) {
        this.provisionedTargets.delete(id);
      }
    }
    if (this.provisionedTargets.size >= maxPreparedTargets) {
      const oldest = this.provisionedTargets.keys().next();
      if (!oldest.done) this.provisionedTargets.delete(oldest.value);
    }
    this.provisionedTargets.set(app.id, {
      ...observation,
      runtime: readinessFingerprint(app),
      expiresAt: now + provisionedAdbReadinessTtlMs,
    });
  }

  prepareViewerTarget(
    expected: ViewerRuntime,
    signal?: AbortSignal,
    purpose: AdbTargetPreparation = 'interactive',
  ) {
    return this.prepareTargetForRuntime(expected, signal, purpose);
  }

  async requireObservedAdbTransport(
    expected: ViewerRuntime & { containerStartedAt: string },
    adbHost: string,
    signal: AbortSignal,
  ) {
    // The snapshot operation has already verified the host and Docker start time.
    const target = await this.prepareTargetForRuntime(
      expected,
      signal,
      'transport',
      adbHost,
    );
    return this.requireConnectedTarget(target);
  }

  private async prepareTargetForRuntime(
    expected: ViewerRuntime,
    signal: AbortSignal | undefined,
    purpose: AdbTargetPreparation,
    observedHost?: string,
  ): Promise<PreparedViewerTarget> {
    signal?.throwIfAborted();
    const app = await this.currentViewerRuntime(expected);
    signal?.throwIfAborted();
    if (observedHost !== undefined && app.networkPolicyEnabled) {
      this.features.assertEnabled('feature.firewall');
    }
    const runtime = readinessFingerprint(app);
    const { key, obsoleteKeys, target } = selectPreparedViewerTarget(
      this.preparedTargets,
      {
        appId: app.id,
        runtime,
        containerStartedAt: expected.containerStartedAt,
        purpose,
        observedHost,
        now: performance.now(),
        generation: this.sidecar.adbTargetGeneration,
      },
    );
    for (const obsoleteKey of obsoleteKeys) {
      this.preparedTargets.delete(obsoleteKey);
    }
    if (target) return target;

    const existing = this.pendingTargets.get(key);
    if (existing) {
      if (!existing.controller.signal.aborted)
        return this.waitForTarget(existing, signal);
      await existing.pending.catch(() => undefined);
      return this.prepareTargetForRuntime(
        expected,
        signal,
        purpose,
        observedHost,
      );
    }
    if (this.pendingTargets.size >= maxPendingTargets) {
      throw new ConflictException('Display target preparation is busy.');
    }

    const controller = new AbortController();
    const preparation: TargetPreparation = {
      appId: app.id,
      controller,
      waiters: 0,
      pending: this.prepareTarget(
        { ...app, containerStartedAt: expected.containerStartedAt },
        runtime,
        key,
        controller.signal,
        purpose,
        observedHost,
      ).finally(() => {
        this.pendingTargets.delete(key);
      }),
    };
    this.pendingTargets.set(key, preparation);
    return this.waitForTarget(preparation, signal);
  }

  async requireViewerTarget(
    app: ViewerRuntime,
    signal?: AbortSignal,
    purpose?: AdbTargetPreparation,
  ) {
    const target = await this.prepareViewerTarget(app, signal, purpose);
    return this.requireConnectedTarget(target);
  }

  private requireConnectedTarget(target: PreparedViewerTarget) {
    if (!target.viewerTarget.configured || !target.viewerTarget.connected) {
      throw new ConflictException(
        target.viewerTarget.message ?? 'Display target is unavailable.',
      );
    }
    return target;
  }

  invalidateViewerTarget(target: PreparedViewerTarget) {
    const prepared = this.preparedTargets.get(target.key);
    if (prepared?.target !== target) return;
    this.preparedTargets.delete(target.key);
    const provisioned = this.provisionedTargets.get(prepared.appId);
    if (
      provisioned?.runtime === prepared.runtime &&
      provisioned.sidecarGeneration === prepared.generation
    )
      this.provisionedTargets.delete(prepared.appId);
  }

  private async prepareTarget(
    app: ViewerRuntime,
    runtime: string,
    key: string,
    signal: AbortSignal,
    purpose: AdbTargetPreparation,
    observedHost?: string,
  ) {
    const network = await this.ensureNetworkPrepared(app);
    signal.throwIfAborted();
    const generation = network.sidecarGeneration;
    const provisioned = this.provisionedTargets.get(app.id);
    if (purpose === 'interactive') this.provisionedTargets.delete(app.id);
    const connected = network.configured && network.connected;
    let observed: ObservedAdbTarget | null = null;
    if (
      connected &&
      provisioned?.runtime === runtime &&
      provisioned.sidecarGeneration === generation &&
      provisioned.expiresAt > performance.now()
    ) {
      observed =
        observedHost === undefined
          ? await this.observeProvisioningAdbTarget(app).catch(() => null)
          : {
              adbHost: observedHost,
              containerStartedAt: app.containerStartedAt ?? null,
            };
    }
    if (
      observed?.containerStartedAt &&
      app.containerStartedAt !== undefined &&
      observed.containerStartedAt !== app.containerStartedAt
    ) {
      throw new ViewerRuntimeChangedError();
    }
    const verified =
      provisioned &&
      observed &&
      observed.adbHost === provisioned.adbHost &&
      observed.containerStartedAt === provisioned.containerStartedAt
        ? provisioned
        : undefined;
    const adbHost =
      observedHost ??
      observed?.adbHost ??
      (await this.resolveScrcpyAdbHost(app));
    signal.throwIfAborted();
    if (generation !== this.sidecar.adbTargetGeneration)
      throw new Error('Display sidecar changed during target preparation.');
    const viewerTarget = connected
      ? await this.prepareScrcpyAdbTarget(app, adbHost, verified, purpose)
      : network;
    signal.throwIfAborted();
    const target = {
      adbHost,
      udid: `${adbHost}:${app.adbPort}`,
      viewerTarget,
      key,
    };
    if (viewerTarget.configured && viewerTarget.connected) {
      const current = await this.currentViewerRuntime(app);
      signal.throwIfAborted();
      if (readinessFingerprint(current) !== runtime)
        throw new ViewerRuntimeChangedError();
      if (generation !== this.sidecar.adbTargetGeneration)
        throw new Error('Display sidecar changed during target preparation.');
      this.expirePreparedTargets();
      if (this.preparedTargets.size >= maxPreparedTargets) {
        const oldest = this.preparedTargets.keys().next();
        if (!oldest.done) this.preparedTargets.delete(oldest.value);
      }
      this.preparedTargets.set(key, {
        appId: app.id,
        runtime,
        target,
        generation,
        expiresAt:
          performance.now() +
          (observedHost === undefined
            ? targetReadinessTtlMs
            : observedTransportTtlMs),
      });
    }
    return target;
  }

  private async waitForTarget(
    preparation: TargetPreparation,
    signal?: AbortSignal,
  ) {
    preparation.waiters += 1;
    let waiting = true;
    const leave = () => {
      if (!waiting) return;
      waiting = false;
      preparation.waiters -= 1;
      if (preparation.waiters === 0) preparation.controller.abort();
    };
    const listener = signal ? addAbortListener(signal, leave) : undefined;
    try {
      // Drain admitted network/ADB work before allowing an interrupted caller to settle.
      return await preparation.pending;
    } finally {
      listener?.[Symbol.dispose]();
      leave();
      signal?.throwIfAborted();
    }
  }

  private expirePreparedTargets() {
    const now = performance.now();
    const generation = this.sidecar.adbTargetGeneration;
    for (const [key, entry] of this.preparedTargets) {
      if (isPreparedViewerTargetExpired(entry, now, generation))
        this.preparedTargets.delete(key);
    }
  }

  /** Coalesces concurrent viewer requests that need the same sidecar attachment. */
  async ensureNetworkPrepared(app: AndroidApplication) {
    return this.coalesce(
      this.networkPreparations,
      app.networkName,
      async () => {
        const sidecarTarget = await this.sidecar.ensureSidecarOnNetwork(
          app.networkName,
        );
        await this.appendLifecycleLog(
          app.id,
          'Display sidecar network prepared',
          {
            networkName: app.networkName,
            configured: sidecarTarget.configured,
            connected: sidecarTarget.connected,
            message: sidecarTarget.message,
          },
        );
        return sidecarTarget;
      },
    );
  }

  async releaseNetwork(app: AndroidApplication) {
    const applicationId = app.id;
    if (!applicationId) {
      this.logger.warn(
        'Could not release display sidecar network: application id is missing.',
      );
      return;
    }
    if (!app.networkName) {
      this.logger.warn(
        `Could not release display sidecar network for ${applicationId}: network name is missing.`,
      );
      return;
    }
    await this.coalesce(this.networkReleases, applicationId, async () => {
      this.provisionedTargets.delete(applicationId);
      for (const [key, entry] of this.preparedTargets) {
        if (entry.appId === applicationId) this.preparedTargets.delete(key);
      }
      const draining: Promise<PreparedViewerTarget>[] = [];
      for (const preparation of this.pendingTargets.values()) {
        if (preparation.appId !== applicationId) continue;
        preparation.controller.abort(new ViewerRuntimeChangedError());
        draining.push(preparation.pending);
      }
      await Promise.allSettled(draining);
      try {
        await this.sidecar.detachSidecarFromNetwork(app.networkName);
        await this.appendLifecycleLog(
          applicationId,
          'Display sidecar network released',
          {
            networkName: app.networkName,
          },
        );
      } catch (error) {
        const message = getErrorMessage(error);
        this.logger.warn(
          `Could not release display sidecar network for ${applicationId}: ${message}`,
        );
        await this.appendLifecycleLog(
          applicationId,
          'Display sidecar network release failed',
          {
            networkName: app.networkName,
            message,
          },
        );
      }
    });
  }

  async resolveScrcpyAdbHost(app: AndroidApplication) {
    if (!app.containerId) {
      return app.containerName;
    }

    return (
      (await this.networks.getContainerIpOnNetwork(
        app.containerId,
        app.networkName,
      )) ?? app.containerName
    );
  }

  async prepareScrcpyAdbTarget(
    app: AndroidApplication,
    adbHost: string,
    provisioned?: ProvisionedAdbReadiness,
    purpose: AdbTargetPreparation = 'interactive',
  ) {
    const targetKey = [
      app.id,
      app.containerId,
      app.networkName,
      app.lastStartedAt,
      app.networkPolicyRevision,
      adbHost,
      app.adbPort,
    ];
    const key = JSON.stringify([...targetKey, purpose]);
    const otherPurpose =
      purpose === 'interactive' ? 'transport' : 'interactive';
    const preceding = this.adbTargetPreparations.get(
      JSON.stringify([...targetKey, otherPurpose]),
    );
    return this.coalesce(this.adbTargetPreparations, key, async () => {
      // Two preparations for the same runtime must not race to reconnect ADB.
      await preceding?.catch(() => undefined);
      return this.prepareScrcpyAdbTargetOnce(
        app,
        adbHost,
        provisioned,
        purpose,
      );
    });
  }

  private async prepareScrcpyAdbTargetOnce(
    app: AndroidApplication,
    adbHost: string,
    provisioned: ProvisionedAdbReadiness | undefined,
    purpose: AdbTargetPreparation,
  ) {
    const current = await this.refreshNetworkPolicy(app);
    if (
      provisioned &&
      (provisioned.purpose === 'interactive' || purpose === 'transport') &&
      provisioned.runtime === readinessFingerprint(current) &&
      provisioned.sidecarGeneration === this.sidecar.adbTargetGeneration &&
      provisioned.expiresAt > performance.now()
    ) {
      return provisioned.target;
    }
    await this.ensureRedroidTcpAdb(app);

    await this.appendLifecycleLog(
      app.id,
      'Preparing display sidecar ADB target',
      {
        networkName: app.networkName,
        containerName: app.containerName,
        containerId: app.containerId,
        adbHost,
        adbPort: app.adbPort,
      },
    );

    const result =
      purpose === 'interactive'
        ? await this.sidecar.connectAdb(adbHost, app.adbPort)
        : await this.sidecar.connectAdb(
            adbHost,
            app.adbPort,
            undefined,
            undefined,
            purpose,
          );
    await this.appendLifecycleLog(
      app.id,
      'Display sidecar ADB target prepared',
      {
        adbHost,
        adbPort: app.adbPort,
        configured: result.configured,
        connected: result.connected,
        message: result.message,
        error: result.error?.message ?? null,
        errorCode: result.error?.code ?? null,
      },
    );

    return result;
  }

  private coalesce<T>(
    pendingOperations: Map<string, Promise<unknown>>,
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const existing = pendingOperations.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const pending = operation().finally(() => {
      if (pendingOperations.get(key) === pending) {
        pendingOperations.delete(key);
      }
    });
    pendingOperations.set(key, pending);
    return pending;
  }

  private refreshNetworkPolicy(expected: AndroidApplication) {
    return this.policyGate.run(expected.id, async () => {
      const app = await this.currentViewerRuntime(expected);
      if (!app.networkPolicyEnabled) return app;
      const result = await this.networkPolicy.refreshViewerPolicy(app);
      if (!(await this.writer.recordViewerNetworkPolicy(app, result))) {
        throw new ViewerRuntimeChangedError();
      }
      if (result.status !== 'applied') {
        throw new Error(
          `Outbound policy enforcement failed: ${result.message}`,
        );
      }
      return app;
    });
  }

  private async currentViewerRuntime(expected: AndroidApplication) {
    const app = await this.queries.getStored(expected.id);
    if (
      this.networkReleases.has(expected.id) ||
      !app.containerId ||
      app.status !== AndroidApplicationStatus.Running ||
      runtimeIdentityKey(app) !== runtimeIdentityKey(expected)
    ) {
      throw new ViewerRuntimeChangedError();
    }
    return app;
  }

  /** Recovered Redroid containers may be running before provisioning enabled TCP ADB. */
  private async ensureRedroidTcpAdb(app: AndroidApplication) {
    if (
      !app.containerId ||
      !isRedroidRuntime(app.containerImage, app.runtimeKind)
    ) {
      return;
    }

    try {
      const result = await this.tcpAdb.prepare(
        { containerId: app.containerId, adbPort: app.adbPort },
        new OperationDeadline(10_000),
      );
      await this.appendLifecycleLog(
        app.id,
        'Redroid TCP ADB ensured for viewer',
        {
          adbPort: app.adbPort,
          message: result.stdout.trim(),
        },
      );
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not ensure Redroid TCP ADB for viewer ${app.id}: ${message}`,
      );
      await this.appendLifecycleLog(
        app.id,
        'Redroid TCP ADB ensure failed for viewer',
        {
          adbPort: app.adbPort,
          message,
        },
      );
    }
  }

  private async appendLifecycleLog(
    applicationId: string | undefined,
    message: string,
    context: unknown,
  ) {
    if (!applicationId) return;
    await this.logs.append(applicationId, message, context);
  }
}
