export enum AutomationRunStartPolicy {
  RequireRunning = 'require-running',
  StartIfNeeded = 'start-if-needed',
}

export interface AutomationRunTargetOptions {
  targetApplicationId?: string | null;
  targetProfileMode?: string | null;
  targetProfileName?: string | null;
  automationTriggerId?: string | null;
  startPolicy?: AutomationRunStartPolicy;
}
