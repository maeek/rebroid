export type AutomationRunEventType =
  | 'run.queued'
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'run.canceled'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.progress'
  | 'ai.model.started'
  | 'ai.model.completed'
  | 'ai.user.message'
  | 'ai.screenshot.observed'
  | 'ai.ui.observed'
  | 'ai.message.delta'
  | 'ai.message.completed'
  | 'ai.tool.started'
  | 'ai.tool.arguments'
  | 'ai.tool.completed'
  | 'ai.tool.failed'
  | 'ai.guardrail.triggered'
  | 'heartbeat';

export interface AutomationRunEventRecord {
  id: string;
  runId: string;
  ownerUserId: string;
  sequence: number;
  type: AutomationRunEventType;
  stepId: string | null;
  parentStepId: string | null;
  message: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface AutomationRunEventInput {
  runId: string;
  ownerUserId: string;
  type: AutomationRunEventType;
  stepId?: string | null;
  parentStepId?: string | null;
  message?: string;
  data?: Record<string, unknown>;
}
