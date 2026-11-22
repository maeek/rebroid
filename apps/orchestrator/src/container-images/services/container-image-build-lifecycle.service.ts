import { Inject, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import {
  DOCKER_GAPPS_WORKER,
  type DockerGappsWorkerPort,
} from '../../docker/contracts/docker-gapps-worker.port';
import type { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import { ContainerImageBuildJobService } from './container-image-build-job.service';

interface ActiveBuild {
  job: ContainerImageBuildJob;
  cancellation: AbortController;
  settled: boolean;
}

@Injectable()
export class ContainerImageBuildLifecycleService {
  private readonly logger = new Logger(
    ContainerImageBuildLifecycleService.name,
  );
  private readonly active = new Map<string, ActiveBuild>();
  private gappsBlocked = false;

  constructor(
    private readonly jobs: ContainerImageBuildJobService,
    @Inject(DOCKER_GAPPS_WORKER)
    private readonly worker: DockerGappsWorkerPort,
  ) {}

  activeBuildIds() {
    return [...this.active.keys()];
  }

  isActive(id: string) {
    return this.active.has(id);
  }

  private get activeGappsBuild() {
    for (const active of this.active.values()) {
      if (active.job.buildKind === 'redroid_gapps_patch') return active;
    }
    return undefined;
  }

  hasActiveGappsBuild(androidVersion?: string) {
    const active = this.activeGappsBuild;
    return (
      !!active &&
      (androidVersion === undefined ||
        active.job.androidVersion === androidVersion)
    );
  }

  async cancelBuild(id: string) {
    const job = await this.jobs.getJob(id);
    const result = this.jobs.isTerminal(job.status)
      ? job
      : await this.jobs.markCancelled(job);
    if (result.status === 'cancelled') {
      this.active
        .get(id)
        ?.cancellation.abort(new Error('Image build cancelled.'));
    }
    return result;
  }

  async run(
    job: ContainerImageBuildJob,
    build: (signal: AbortSignal) => Promise<string>,
    cleanup?: () => Promise<void>,
  ): Promise<void> {
    if (
      this.active.has(job.id) ||
      (job.buildKind === 'redroid_gapps_patch' && this.hasActiveGappsBuild())
    ) {
      return;
    }
    const active: ActiveBuild = {
      job,
      cancellation: new AbortController(),
      settled: false,
    };
    const { signal } = active.cancellation;
    this.active.set(job.id, active);
    try {
      if (!(await this.jobs.markRunning(job))) return;
      signal.throwIfAborted();
      const imageId = await build(signal);
      signal.throwIfAborted();
      await this.jobs.markSucceeded(job, imageId);
    } catch (error) {
      if (!signal.aborted) {
        await this.jobs.markFailed(job, getErrorMessage(error));
      }
    } finally {
      try {
        await cleanup?.();
      } catch (error) {
        this.logger.error(
          `Could not clean staging for image build ${job.id}: ${getErrorMessage(error)}`,
        );
      } finally {
        if (job.buildKind === 'redroid_gapps_patch') active.settled = true;
        else this.active.delete(job.id);
      }
    }
  }

  async confirmGappsSlotAvailable(): Promise<boolean> {
    const active = this.activeGappsBuild;
    if (active && !active.settled) return false;

    try {
      if (await this.worker.hasUnstoppedWorkers()) {
        return this.blockGapps('a managed GApps worker has not stopped');
      }
    } catch (error) {
      return this.blockGapps(getErrorMessage(error));
    }

    if (active) this.active.delete(active.job.id);
    this.gappsBlocked = false;
    return true;
  }

  private blockGapps(reason: string): false {
    if (!this.gappsBlocked) {
      this.logger.warn(`GApps build queue paused: ${reason}`);
    }
    this.gappsBlocked = true;
    return false;
  }
}
