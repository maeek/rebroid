export const AUTOMATION_API_VERSION = 'rebroid.io/automation/v1' as const;
export const AUTOMATION_KIND = 'AndroidAutomation' as const;

export interface AutomationDefinitionMetadata {
  name: string;
  description?: string;
  tags?: string[];
}

export interface AutomationActionStep {
  id: string;
  uses: string;
  with: Record<string, unknown>;
}

export type AutomationPredicateOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'exists'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'matches';

export interface AutomationValueRef {
  source: 'literal' | 'context' | 'step';
  value?: unknown;
  path?: string;
  stepId?: string;
}

export interface AutomationPredicate {
  left: AutomationValueRef;
  operator: AutomationPredicateOperator;
  right?: AutomationValueRef;
}

export interface AutomationConditionStep {
  id: string;
  type: 'condition';
  condition: AutomationPredicate;
  then: AutomationDefinitionStep[];
  else?: AutomationDefinitionStep[];
}

export interface AutomationSwitchCase {
  value: unknown;
  steps: AutomationDefinitionStep[];
}

export interface AutomationSwitchStep {
  id: string;
  type: 'switch';
  value: AutomationValueRef;
  cases: AutomationSwitchCase[];
  default?: AutomationDefinitionStep[];
}

export interface AutomationRepeatStep {
  id: string;
  type: 'repeat';
  count?: number;
  while?: AutomationPredicate;
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
