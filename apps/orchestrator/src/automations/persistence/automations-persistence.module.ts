import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Automation } from '../entities/automation.entity';
import { AutomationRun } from '../entities/automation-run.entity';
import { AutomationRunsRepository } from './automation-runs.repository';
import { AutomationsRepository } from './automations.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Automation, AutomationRun])],
  providers: [AutomationsRepository, AutomationRunsRepository],
  exports: [AutomationsRepository, AutomationRunsRepository],
})
export class AutomationsPersistenceModule {}
