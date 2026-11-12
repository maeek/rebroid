export const WORKFLOW_HISTORY_MAINTENANCE = Symbol(
  'WORKFLOW_HISTORY_MAINTENANCE',
);

export interface WorkflowHistoryMaintenancePort {
  pruneWorkflowHistory(cutoff: Date): Promise<{ removedRuns: number }>;
}
