import { Module } from '@nestjs/common';
import { AndroidAppsModule } from '../../android-apps/android-apps.module';
import { MetricsModule } from '../../metrics/metrics.module';
import { AutomationAiModule } from '../ai/automation-ai.module';
import { AutomationCommandsModule } from '../commands/automation-commands.module';
import { AutomationDefinitionModule } from '../definition/automation-definition.module';
import { AutomationEventsModule } from '../events/automation-events.module';
import { AutomationsPersistenceModule } from '../persistence/automations-persistence.module';
import { AutomationRunExecutionService } from './automation-run-execution.service';
import { AutomationRunFinalizerService } from './automation-run-finalizer.service';
import { AutomationRunnableResolverService } from './automation-runnable-resolver.service';
import { AutomationRunnerRecorderService } from './automation-runner-recorder.service';
import { AutomationRunnerTargetService } from './automation-runner-target.service';
import { AutomationRunnerService } from './automation-runner.service';
import { AutomationStepExecutorService } from './automation-step-executor.service';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';

@Module({
  imports: [
    AndroidAppsModule,
    MetricsModule,
    AutomationAiModule,
    AutomationCommandsModule,
    AutomationDefinitionModule,
    AutomationEventsModule,
    AutomationsPersistenceModule,
  ],
  providers: [
    AutomationRunExecutionService,
    AutomationRunFinalizerService,
    AutomationRunnableResolverService,
    AutomationRunnerRecorderService,
    AutomationRunnerTargetService,
    AutomationRunnerService,
    AutomationStepExecutorService,
    EphemeralAutomationRegistryService,
  ],
  exports: [AutomationRunnerService],
})
export class AutomationExecutionModule {}
