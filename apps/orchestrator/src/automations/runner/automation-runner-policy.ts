import { AutomationStartPolicy } from '../entities/automation-trigger.entity';
import { AutomationRunStartPolicy } from './automation-runner-options';

export const toAutomationRunStartPolicy = (
  policy: AutomationStartPolicy,
): AutomationRunStartPolicy =>
  policy === AutomationStartPolicy.StartIfNeeded
    ? AutomationRunStartPolicy.StartIfNeeded
    : AutomationRunStartPolicy.RequireRunning;
