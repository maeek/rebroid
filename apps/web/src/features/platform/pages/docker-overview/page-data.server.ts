import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'

export const loadDockerOverviewPageData = async () => {
  const health = await readOrchestratorPage(getOrchestratorHealthSummaryAction)

  return {
    initialHealth: health.ok ? health.data : null,
    requestId: health.ok ? undefined : health.failure.requestId
  }
}
