import type { AutomationRunStatus } from './automation'
export interface PlatformOperationsSnapshot {
  failedCount: number
  pendingCount: number
  activeRunCount: number
  failed: Array<{ id: string; name: string; description: string | null }>
  pending: Array<{ id: string; name: string; title: string }>
  runs: Array<{ id: string; automationId: string; status: AutomationRunStatus }>
}
