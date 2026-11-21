import type { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

export type CronTick = {
  cronExpression: string;
  isCurrent: () => boolean;
};

export function unregisterCron(scheduler: SchedulerRegistry, name: string) {
  if (scheduler.doesExist('cron', name)) scheduler.deleteCronJob(name);
}

export function registerCron(
  scheduler: SchedulerRegistry,
  name: string,
  cronExpression: string | null,
  onTick: (tick: CronTick) => void,
) {
  if (!cronExpression) {
    unregisterCron(scheduler, name);
    return;
  }
  const current = scheduler.getCronJobs().get(name);
  if (current?.isActive && current.cronTime.source === cronExpression) return;

  const job: CronJob = CronJob.from({
    cronTime: cronExpression,
    onTick: () =>
      onTick({
        cronExpression,
        isCurrent: () => scheduler.getCronJobs().get(name) === job,
      }),
    start: false,
  });
  // Verify the replacement has a valid next tick before retiring the old timer.
  job.nextDate();
  unregisterCron(scheduler, name);
  scheduler.addCronJob(name, job);
  job.start();
}
