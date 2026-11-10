import { Injectable, Logger } from '@nestjs/common';
import pLimit from 'p-limit';
import { getErrorMessage } from '../../../common/error-message';
import { LifecycleConfigService } from '../../../config/lifecycle-config.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import type { AndroidAppLifecycleReservation } from '../entities/android-app-lifecycle-job.entity';

type ScheduledJob = {
  started: boolean;
  cancelled: boolean;
  done: Promise<void>;
};

@Injectable()
export class LifecycleBackgroundJobRunner {
  private readonly logger = new Logger(LifecycleBackgroundJobRunner.name);
  private readonly scheduled = new Map<string, Map<string, ScheduledJob>>();
  private readonly limitBackgroundJob: ReturnType<typeof pLimit>;

  constructor(
    config: LifecycleConfigService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
  ) {
    this.limitBackgroundJob = pLimit(config.maxConcurrentJobs);
  }

  hasWork(applicationId: string) {
    return this.scheduled.has(applicationId);
  }

  schedule(
    reservation: AndroidAppLifecycleReservation,
    operation: () => Promise<void>,
  ) {
    const { id, applicationId } = reservation;
    if (this.tracker.isCancelled(applicationId)) return;
    const jobs =
      this.scheduled.get(applicationId) ?? new Map<string, ScheduledJob>();
    if (jobs.has(id)) return;

    const previous = [...jobs.values()].at(-1)?.done ?? Promise.resolve();
    const entry: ScheduledJob = {
      started: false,
      cancelled: false,
      done: previous,
    };
    entry.done = previous
      .then(() =>
        this.limitBackgroundJob(async () => {
          if (entry.cancelled) return;
          entry.started = true;
          await operation();
        }),
      )
      .catch((error: unknown) => {
        this.logger.error(
          `Lifecycle job ${id} failed: ${getErrorMessage(error)}`,
        );
      })
      .finally(() => {
        if (jobs.get(id) === entry) jobs.delete(id);
        if (!jobs.size && this.scheduled.get(applicationId) === jobs)
          this.scheduled.delete(applicationId);
      });
    jobs.set(id, entry);
    this.scheduled.set(applicationId, jobs);
  }

  async interrupt<T>(
    applicationId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    this.tracker.cancel(applicationId);
    const jobs = this.scheduled.get(applicationId);
    const draining: Promise<void>[] = [];
    for (const [id, job] of jobs ?? []) {
      if (job.started) draining.push(job.done);
      else {
        job.cancelled = true;
        jobs?.delete(id);
      }
    }
    if (!jobs?.size) this.scheduled.delete(applicationId);

    try {
      // Keep the existing reservation valid until a running effect has published its resource IDs.
      await Promise.all(draining);
      return await operation();
    } finally {
      this.tracker.reset(applicationId);
    }
  }
}
