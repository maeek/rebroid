import { Module } from '@nestjs/common';
import { AndroidAppsModule } from '../android-apps/android-apps.module';
import { AutomationAiModule } from './ai/automation-ai.module';
import { AutomationCommandsModule } from './commands/automation-commands.module';
import { AutomationsController } from './controllers/automations.controller';
import { AutomationDefinitionModule } from './definition/automation-definition.module';
import { AutomationEventsModule } from './events/automation-events.module';
import { AutomationsPersistenceModule } from './persistence/automations-persistence.module';
import { AutomationExecutionModule } from './runner/automation-execution.module';
import { AutomationSchedulingModule } from './scheduler/automation-scheduling.module';
import { AutomationTargetApplicationService } from './services/automation-target-application.service';
import { AutomationTriggersService } from './services/automation-triggers.service';
import { AutomationsDtoMapper } from './services/automations-dto-mapper.service';
import { AutomationsQueryService } from './services/automations-query.service';
import { AutomationsService } from './services/automations.service';

@Module({
  imports: [
    AndroidAppsModule,
    AutomationsPersistenceModule,
    AutomationCommandsModule,
    AutomationEventsModule,
    AutomationAiModule,
    AutomationDefinitionModule,
    AutomationExecutionModule,
    AutomationSchedulingModule,
  ],
  controllers: [AutomationsController],
  providers: [
    AutomationTargetApplicationService,
    AutomationTriggersService,
    AutomationsDtoMapper,
    AutomationsQueryService,
    AutomationsService,
  ],
  exports: [AutomationEventsModule],
})
export class AutomationsModule {}
