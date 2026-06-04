export const AUTOMATION_API_VERSION = 'rebroid.io/automation/v1' as const;
export const AUTOMATION_KIND = 'AndroidAutomation' as const;

export interface AutomationDefinitionMetadata {
  name: string;
  description?: string;
  labels?: Record<string, string>;
}

export interface AutomationDefinitionStep {
  id: string;
  uses: string;
  with: Record<string, unknown>;
}

export interface AutomationDefinitionSpec {
  steps: AutomationDefinitionStep[];
}

export interface AutomationDefinition {
  apiVersion: typeof AUTOMATION_API_VERSION;
  kind: typeof AUTOMATION_KIND;
  metadata: AutomationDefinitionMetadata;
  spec: AutomationDefinitionSpec;
}

export interface RawAutomationDefinition {
  apiVersion?: unknown;
  kind?: unknown;
  metadata?: unknown;
  spec?: unknown;
}
