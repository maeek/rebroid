export interface AutomationStepResult {
  stepId: string;
  uses: string;
  parentStepId?: string | null;
  path?: string;
  status: 'success' | 'failed' | 'skipped';
  startedAt: string;
  completedAt: string;
  output: Record<string, unknown> | null;
  error: string | null;
}
