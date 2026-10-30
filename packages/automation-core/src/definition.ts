export const AUTOMATION_API_VERSION = "rebroid.io/automation/v1" as const;
export const AUTOMATION_KIND = "AndroidAutomation" as const;

export type AutomationValueType =
  "string" | "number" | "boolean" | "array" | "object" | "unknown";

export interface AutomationTag {
  name: string;
  color: string;
}

export const DEFAULT_AUTOMATION_TAG_COLOR = "#64748b" as const;

export interface AutomationDefinitionMetadata {
  name: string;
  description?: string;
  tags?: AutomationTag[];
}

export interface AutomationCommandOutputMetadata {
  key: string;
  label: string;
  type: AutomationValueType;
  description: string;
  example?: unknown;
}

export type AutomationCommandOutput = AutomationCommandOutputMetadata;

export interface AutomationActionStep {
  id: string;
  uses: string;
  with: Record<string, unknown>;
}

export type AutomationConditionOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "doesNotContain"
  | "exists"
  | "doesNotExist"
  | "isEmpty"
  | "isNotEmpty"
  | "isTrue"
  | "isFalse"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "matches"
  | "lengthEquals"
  | "lengthGreaterThan"
  | "lengthLessThan";

export type AutomationValueRef =
  | {
      source: "literal";
      value?: unknown;
    }
  | {
      source: "runContext";
      key: string;
    }
  | {
      source: "stepOutput";
      stepId: string;
      outputKey: string;
    };

export interface AutomationConditionRule {
  value: AutomationValueRef;
  operator: AutomationConditionOperator;
  compare?: AutomationValueRef;
}

export interface AutomationConditionGroup {
  conditions: AutomationConditionRule[];
}

export interface AutomationConditionExpression {
  groups: AutomationConditionGroup[];
}

export interface AutomationSwitchCase {
  value: unknown;
  steps: AutomationDefinitionStep[];
}

export interface AutomationConditionStep {
  id: string;
  type: "condition";
  condition: AutomationConditionExpression;
  then: AutomationDefinitionStep[];
  else?: AutomationDefinitionStep[];
}

export interface AutomationSwitchStep {
  id: string;
  type: "switch";
  value: AutomationValueRef;
  cases: AutomationSwitchCase[];
  default?: AutomationDefinitionStep[];
}

export interface AutomationRepeatStep {
  id: string;
  type: "repeat";
  count?: number;
  while?: AutomationConditionExpression;
  maxIterations: number;
  steps: AutomationDefinitionStep[];
}

export type AutomationDefinitionStep =
  | AutomationActionStep
  | AutomationConditionStep
  | AutomationSwitchStep
  | AutomationRepeatStep;

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
