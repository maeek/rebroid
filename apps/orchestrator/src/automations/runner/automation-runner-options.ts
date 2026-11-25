export enum AutomationRunStartPolicy {
  RequireRunning = 'require-running',
  StartIfNeeded = 'start-if-needed',
}

export interface AutomationRunTargetOptions {
  targetDeviceId?: string | null;
  targetKind?: 'managed' | 'external';
  targetAttachmentId?: string | null;
  targetProfileMode?: string | null;
  targetProfileName?: string | null;
  automationTriggerId?: string | null;
  startPolicy?: AutomationRunStartPolicy;
  currentProfileOnly?: boolean;
}

export type AdmitAutomationTargetWork = <T>(
  operation: () => Promise<T>,
) => Promise<T>;
