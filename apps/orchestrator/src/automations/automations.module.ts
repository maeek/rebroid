import { Module } from '@nestjs/common';
import { AndroidAppsCommonModule } from '../android-apps/common/android-apps-common.module';
import { AndroidAppsLifecycleModule } from '../android-apps/lifecycle/android-apps-lifecycle.module';
import { AndroidAppsRuntimeNetworkModule } from '../android-apps/network/android-apps-runtime-network.module';
import { AndroidAppsViewerModule } from '../android-apps/viewer/android-apps-viewer.module';
import { AndroidAutomationCommandsService } from './commands/android-automation-commands.service';
import { AutomationCommandRegistryService } from './commands/automation-command-registry.service';
import { ContainerNetworkAutomationCommandsService } from './commands/container-network-automation-commands.service';
import { GenericAutomationCommandsService } from './commands/generic-automation-commands.service';
import { AutomationConditionService } from './condition/automation-condition.service';
import { AutomationsController } from './controllers/automations.controller';
import { AutomationDefinitionService } from './definition/automation-definition.service';
import { AutomationsPersistenceModule } from './persistence/automations-persistence.module';
import { AutomationRunnerService } from './runner/automation-runner.service';
import { AutomationCronRegistryService } from './scheduler/automation-cron-registry.service';
import { AutomationScheduleService } from './scheduler/automation-schedule.service';
import { AutomationsService } from './services/automations.service';

@Module({
  imports: [
    AutomationsPersistenceModule,
    AndroidAppsCommonModule,
    AndroidAppsLifecycleModule,
    AndroidAppsViewerModule,
    AndroidAppsRuntimeNetworkModule,
  ],
  controllers: [AutomationsController],
  providers: [
    AndroidAutomationCommandsService,
    ContainerNetworkAutomationCommandsService,
    GenericAutomationCommandsService,
    AutomationCommandRegistryService,
    AutomationConditionService,
    AutomationDefinitionService,
    AutomationRunnerService,
    AutomationCronRegistryService,
    AutomationScheduleService,
    AutomationsService,
  ],
})
export class AutomationsModule {}
