import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Automation } from '../entities/automation.entity';
import { AutomationRun } from '../entities/automation-run.entity';
import { AutomationRunEvent } from '../entities/automation-run-event.entity';
import { AutomationTrigger } from '../entities/automation-trigger.entity';
import { AutomationRunEventsRepository } from './automation-run-events.repository';
import { AutomationRunsRepository } from './automation-runs.repository';
import { AutomationTriggersRepository } from './automation-triggers.repository';
import { AutomationsRepository } from './automations.repository';
import { AutomationPersistenceQueue } from './automation-persistence-queue';
import { MetricsModule } from '../../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Automation,
      AutomationRun,
      AutomationRunEvent,
      AutomationTrigger,
    ]),
    MetricsModule,
  ],
  providers: [
    AutomationPersistenceQueue,
    AutomationsRepository,
    AutomationRunEventsRepository,
    AutomationRunsRepository,
    AutomationTriggersRepository,
  ],
  exports: [
    AutomationsRepository,
    AutomationRunEventsRepository,
    AutomationRunsRepository,
    AutomationTriggersRepository,
  ],
})
export class AutomationsPersistenceModule {}
