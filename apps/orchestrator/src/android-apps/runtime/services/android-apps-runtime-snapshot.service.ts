import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../../docker/contracts/docker-engine.port';
import type { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import {
  AndroidAppsRuntimeOperationGate,
  AndroidRuntimeNotRunningError,
} from '../../common/services/android-apps-runtime-operation-gate.service';
import {
  snapshotRuntimeKey,
  type AndroidRuntimeIdentity,
} from '../../common/utils/android-runtime-identity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidAppRuntimeSnapshotsRepository } from '../../persistence/android-app-runtime-snapshots.repository';
import { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';
import type { ApplicationRuntimeSnapshotDto } from '../dto/application-runtime-snapshot.dto';
import {
  encodeRuntimeSnapshot,
  maximumSnapshotResponseBytes,
} from '../utils/encode-runtime-snapshot';

const captureTimeoutMs = 12_000;
const captureConcurrency = 4;
const sweepTimeoutMs = 45_000;
const previewDemandMs = 2 * 60_000;
const maximumDemandEntries = 1_024;

@Injectable()
export class AndroidAppsRuntimeSnapshotService {
  private readonly logger = new Logger(AndroidAppsRuntimeSnapshotService.name);

  private readonly demandedUntil = new Map<string, number>();
  private readonly lastAttempt = new Map<string, number>();
  private attempt = 0;
  private sweep?: Promise<void>;

  constructor(
    private readonly queries: AndroidAppsQueryService,
    private readonly runtimeOperations: AndroidAppsRuntimeOperationGate,
    private readonly snapshots: AndroidAppRuntimeSnapshotsRepository,
    private readonly adb: AndroidAppsSidecarAdbService,
    @Inject(DOCKER_ENGINE)
    private readonly engine: DockerEnginePort,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'android-app-runtime-snapshots',
    waitForCompletion: true,
  })
  captureRunningApplications() {
    this.sweep ??= this.runSweep().finally(() => {
      this.sweep = undefined;
    });
    return this.sweep;
  }

  @Cron('20 */5 * * * *', {
    name: 'android-app-runtime-snapshot-prune',
    waitForCompletion: true,
  })
  async pruneSnapshots() {
    try {
      const running = await this.queries.listOwnedRunningSnapshotTargets();
      await this.snapshots.prune(new Set(running.map(({ id }) => id)));
    } catch {
      this.logger.warn('Could not prune runtime snapshots.');
    }
  }

  private async runSweep() {
    const signal = AbortSignal.timeout(sweepTimeoutMs);
    const runtimes = await this.queries.listOwnedRunningSnapshotTargets();
    const eligible = new Set(runtimes.map(({ id }) => id));
    for (const id of this.lastAttempt.keys()) {
      if (!eligible.has(id)) this.lastAttempt.delete(id);
    }
    const now = performance.now();
    for (const [id, expires] of this.demandedUntil) {
      if (!eligible.has(id) || expires <= now) this.demandedUntil.delete(id);
    }
    const ranked = [...runtimes].sort(
      (left, right) =>
        (this.lastAttempt.get(left.id) ?? 0) -
        (this.lastAttempt.get(right.id) ?? 0),
    );
    const priority = ranked
      .filter(({ id }) => this.demandedUntil.has(id))
      .values();
    const warm = ranked
      .filter(({ id }) => !this.demandedUntil.has(id))
      .values();
    let preferDemand = true;

    const next = () => {
      const first = preferDemand ? priority : warm;
      const second = preferDemand ? warm : priority;
      preferDemand = !preferDemand;
      const result = first.next();
      if (!result.done) return result.value;
      const alternate = second.next();
      return alternate.done ? undefined : alternate.value;
    };
    const worker = async () => {
      while (!signal.aborted) {
        const runtime = next();
        if (!runtime) return;
        this.lastAttempt.set(runtime.id, ++this.attempt);
        await this.capture(runtime, signal);
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(captureConcurrency, runtimes.length) },
        worker,
      ),
    );
  }

  async read(
    id: string,
    ownerUserId: string,
  ): Promise<ApplicationRuntimeSnapshotDto> {
    const signal = AbortSignal.timeout(3_000);
    try {
      const app = await this.queries.getStored(id);
      if (
        app.ownerUserId !== ownerUserId ||
        app.status !== AndroidApplicationStatus.Running
      ) {
        throw this.unavailable();
      }
      this.demandedUntil.delete(id);
      if (this.demandedUntil.size >= maximumDemandEntries) {
        const oldest = this.demandedUntil.keys().next();
        if (!oldest.done) this.demandedUntil.delete(oldest.value);
      }
      this.demandedUntil.set(id, performance.now() + previewDemandMs);
      const snapshot = await this.snapshots.read(id);
      if (!snapshot || snapshot.runtimeKey !== snapshotRuntimeKey(app))
        throw this.unavailable();
      return await this.runtimeOperations.withCurrentRuntime(
        app,
        signal,
        async (target, managedAdbHost) => {
          const current = await this.queries.getStored(id);
          signal.throwIfAborted();
          if (
            current.status !== AndroidApplicationStatus.Running ||
            snapshot.runtimeKey !== snapshotRuntimeKey(current) ||
            snapshot.containerStartedAt !== target.containerStartedAt ||
            !managedAdbHost
          ) {
            throw this.unavailable();
          }
          return {
            mimeType: 'image/webp',
            dataUrl: `data:image/webp;base64,${snapshot.content.toString('base64')}`,
            capturedAt: snapshot.capturedAt,
          };
        },
      );
    } catch (error) {
      if (this.isUnavailableRuntime(error)) {
        throw this.unavailable();
      }
      throw new ServiceUnavailableException(
        'Snapshot runtime could not be verified.',
      );
    }
  }

  private async capture(expected: AndroidRuntimeIdentity, sweep: AbortSignal) {
    const signal = AbortSignal.any([
      sweep,
      AbortSignal.timeout(captureTimeoutMs),
    ]);
    let previous: Awaited<
      ReturnType<AndroidAppRuntimeSnapshotsRepository['readMetadata']>
    > = null;
    try {
      previous = await this.snapshots.readMetadata(expected.id);
      signal.throwIfAborted();
      await this.runtimeOperations.withCurrentRuntime(
        expected,
        signal,
        async (app, host) => {
          const { id, ownerUserId, containerId, containerStartedAt } = app;
          const runtimeKey = snapshotRuntimeKey(app);
          if (
            previous &&
            (!host ||
              previous.containerStartedAt !== containerStartedAt ||
              previous.runtimeKey !== runtimeKey)
          ) {
            await this.snapshots.deleteObserved(id, previous);
            previous = null;
          }
          if (!ownerUserId || !containerId || !host) return;
          signal.throwIfAborted();

          const image = await this.captureThumbnail(app, host, signal);
          if (!image) return;
          signal.throwIfAborted();
          const verified = await this.runtimeOperations.observeContainer(
            app,
            signal,
          );
          if (
            verified?.containerStartedAt !== containerStartedAt ||
            verified.managedAdbHost !== host
          ) {
            if (previous) await this.snapshots.deleteObserved(id, previous);
            return;
          }
          await this.snapshots.replace(
            id,
            { runtimeKey, containerStartedAt, ...image },
            async () => {
              const current = await this.queries.getStored(id);
              signal.throwIfAborted();
              return (
                current.status === AndroidApplicationStatus.Running &&
                snapshotRuntimeKey(current) === runtimeKey
              );
            },
          );
        },
      );
    } catch (error) {
      if (
        error instanceof AndroidRuntimeNotRunningError ||
        this.engine.isDockerNotFound(error)
      ) {
        if (previous)
          await this.snapshots.deleteObserved(expected.id, previous);
        return;
      }
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        return;
      }
      this.logger.debug(
        `Could not refresh runtime snapshot for ${expected.id}.`,
      );
    }
  }

  private async captureThumbnail(
    app: AndroidApplication & { containerStartedAt: string },
    host: string,
    signal: AbortSignal,
  ) {
    try {
      const png = await this.adb.captureSnapshotPng(
        app,
        host,
        signal,
        maximumSnapshotResponseBytes,
      );
      signal.throwIfAborted();
      return await encodeRuntimeSnapshot(png);
    } catch {
      this.logger.debug(`Could not capture runtime snapshot for ${app.id}.`);
      return null;
    }
  }

  private isUnavailableRuntime(error: unknown) {
    return (
      error instanceof ConflictException ||
      error instanceof NotFoundException ||
      this.engine.isDockerNotFound(error)
    );
  }

  private unavailable() {
    return new NotFoundException('Application snapshot is unavailable.');
  }
}
