import {
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import pLimit from 'p-limit';
import { waitForOperation } from '../../../common/wait-for-operation';
import type { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';

const SAMPLE_FRESHNESS_MS = 5_000;
const COLLECTION_TIMEOUT_MS = 8_000;
const MAX_QUEUED_COLLECTIONS = 64;
const MAX_CACHED_APPS = 64;
const MAX_SAMPLE_BYTES = 128 * 1024;

type Notifications = Awaited<
  ReturnType<AndroidAppsSidecarAdbService['notifications']>
>;

const isRunning = (app: AndroidApplication) =>
  app.containerId !== null &&
  app.status === AndroidApplicationStatus.Running &&
  app.lifecycleStage !== AndroidApplicationLifecycleStage.Stopping;

const runtimeKey = (app: AndroidApplication) =>
  JSON.stringify([
    app.id,
    app.ownerUserId,
    app.containerId,
    app.lastStartedAt?.getTime(),
    app.profileMode,
    app.profileName,
    app.containerName,
    app.networkName,
    app.adbPort,
  ]);

@Injectable()
export class AndroidAppsRuntimeNotificationsService {
  private readonly collectWithLimit = pLimit(4);
  private readonly pending = new Map<string, Promise<Notifications>>();
  private readonly samples = new Map<
    string,
    { runtime: string; expiresAt: number; notifications: Notifications }
  >();

  constructor(
    private readonly queries: AndroidAppsQueryService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly sidecarAdb: AndroidAppsSidecarAdbService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
  ) {}

  async list(id: string): Promise<Notifications> {
    const app = await this.queries.getStored(id);
    if (this.tracker.isCancelled(id)) {
      this.samples.delete(id);
      return [];
    }
    const runtime = runtimeKey(app);
    const sample = this.samples.get(id);
    if (
      sample &&
      isRunning(app) &&
      sample.runtime === runtime &&
      sample.expiresAt > performance.now()
    ) {
      return sample.notifications;
    }
    this.samples.delete(id);

    const requestKey = JSON.stringify([
      runtime,
      app.status,
      app.lifecycleStage,
    ]);
    const pending = this.pending.get(requestKey);
    if (pending) return pending;
    if (this.collectWithLimit.pendingCount >= MAX_QUEUED_COLLECTIONS) {
      throw new ServiceUnavailableException(
        'Android notification collection is busy.',
      );
    }

    const signal = AbortSignal.timeout(COLLECTION_TIMEOUT_MS);
    const work = this.collectWithLimit(() =>
      this.collect(app, runtime, signal),
    ).finally(() => {
      this.pending.delete(requestKey);
    });
    const response = waitForOperation(work, signal).catch((error: unknown) => {
      if (signal.aborted) {
        throw new GatewayTimeoutException(
          'Android notification collection timed out.',
        );
      }
      throw error;
    });
    this.pending.set(requestKey, response);
    return response;
  }

  private async collect(
    expected: AndroidApplication,
    runtime: string,
    signal: AbortSignal,
  ): Promise<Notifications> {
    signal.throwIfAborted();
    const stored = await this.queries.getStored(expected.id);
    signal.throwIfAborted();
    if (
      this.tracker.isCancelled(stored.id) ||
      runtimeKey(stored) !== runtime ||
      stored.status !== expected.status ||
      stored.lifecycleStage !== expected.lifecycleStage
    ) {
      return [];
    }

    const { application: app, outcome } =
      await this.reconciler.reconcileOneWithResult(stored);
    signal.throwIfAborted();
    if (!isRunning(app)) return [];
    if (outcome === 'unavailable') {
      throw new ServiceUnavailableException(
        'Android runtime could not be verified.',
      );
    }

    const verifiedRuntime = runtimeKey(app);
    // Reconciliation can record the first start of a recovered container.
    const recoveredFirstStart =
      outcome === 'updated' &&
      !expected.lastStartedAt &&
      runtimeKey({ ...app, lastStartedAt: null }) === runtime;
    if (verifiedRuntime !== runtime && !recoveredFirstStart) return [];
    if (!(await this.isCurrent(app.id, verifiedRuntime))) return [];

    const expiresAt = performance.now() + SAMPLE_FRESHNESS_MS;
    const notifications = await this.sidecarAdb.notifications(app, signal);
    if (!(await this.isCurrent(app.id, verifiedRuntime))) return [];
    signal.throwIfAborted();
    this.cache(app.id, verifiedRuntime, expiresAt, notifications);
    return notifications;
  }

  private async isCurrent(id: string, runtime: string) {
    const app = await this.queries.getStored(id);
    return (
      !this.tracker.isCancelled(id) &&
      isRunning(app) &&
      runtimeKey(app) === runtime
    );
  }

  private cache(
    id: string,
    runtime: string,
    expiresAt: number,
    notifications: Notifications,
  ) {
    const now = performance.now();
    if (expiresAt <= now) return;
    let bytes = 0;
    for (const notification of notifications) {
      bytes +=
        128 +
        2 *
          (notification.raw.length +
            notification.title.length +
            notification.text.length +
            notification.packageName.length);
      if (bytes > MAX_SAMPLE_BYTES) return;
    }
    for (const [appId, sample] of this.samples) {
      if (sample.expiresAt <= now) this.samples.delete(appId);
    }
    if (this.samples.size >= MAX_CACHED_APPS) {
      const oldest = this.samples.keys().next();
      if (!oldest.done) this.samples.delete(oldest.value);
    }
    this.samples.set(id, { runtime, expiresAt, notifications });
  }
}
