import { AutomationDefinition } from '@rebroid/automation-core/definition';
import { Automation } from '../entities/automation.entity';

export interface RunnableAutomation {
  definition: AutomationDefinition;
  entity: Automation;
  ephemeral: boolean;
}
