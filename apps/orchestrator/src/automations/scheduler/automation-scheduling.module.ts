import { Module } from '@nestjs/common';
import { AutomationTriggerSchedulerService } from '../services/automation-trigger-scheduler.service';
import { AutomationCronRegistryService } from './automation-cron-registry.service';

@Module({
  providers: [AutomationCronRegistryService, AutomationTriggerSchedulerService],
  exports: [AutomationTriggerSchedulerService],
})
export class AutomationSchedulingModule {}
