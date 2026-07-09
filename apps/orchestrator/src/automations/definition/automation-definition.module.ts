import { Module } from '@nestjs/common';
import { AutomationAiDefinitionFactory } from '../ai/automation-ai-definition.factory';
import { AutomationAiYamlDraftService } from '../ai/automation-ai-yaml-draft.service';
import { AutomationAiModule } from '../ai/automation-ai.module';
import { AutomationCommandsModule } from '../commands/automation-commands.module';
import { AutomationConditionService } from '../condition/automation-condition.service';
import { AutomationDefinitionNormalizerService } from './automation-definition-normalizer.service';
import { AutomationDefinitionService } from './automation-definition.service';

@Module({
  imports: [AutomationCommandsModule, AutomationAiModule],
  providers: [
    AutomationConditionService,
    AutomationDefinitionNormalizerService,
    AutomationDefinitionService,
    AutomationAiDefinitionFactory,
    AutomationAiYamlDraftService,
  ],
  exports: [
    AutomationConditionService,
    AutomationDefinitionService,
    AutomationAiDefinitionFactory,
    AutomationAiYamlDraftService,
  ],
})
export class AutomationDefinitionModule {}
