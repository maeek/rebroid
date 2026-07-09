import { Module } from '@nestjs/common';
import { AutomationTriggerSchedulerService } from '../services/automation-trigger-scheduler.service';
import { AutomationCronRegistryService } from './automation-cron-registry.service';
import { AutomationScheduleService } from './automation-schedule.service';

@Module({
  providers: [
    AutomationCronRegistryService,
    AutomationScheduleService,
    AutomationTriggerSchedulerService,
  ],
  exports: [AutomationTriggerSchedulerService],
})
export class AutomationSchedulingModule {}
