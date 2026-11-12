import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import {
  ActiveWorkflowRunsPage,
  activeWorkflowRunsDescription,
  activeWorkflowRunsTitle,
  activeWorkflowRunsTrail
} from './active-workflow-runs-page'
import { loadActiveWorkflowRuns } from './page-data.server'

export const ActiveWorkflowRunsPageEntry = () => (
  <OrchestratorPageBoundary
    load={loadActiveWorkflowRuns}
    fallback={requestId => (
      <PlatformRouteUnavailable
        title={activeWorkflowRunsTitle}
        description={activeWorkflowRunsDescription}
        section={{ label: 'Automations' }}
        trail={activeWorkflowRunsTrail}
        requestId={requestId}
      />
    )}
  >
    {({ runs, targets }) => (
      <ActiveWorkflowRunsPage
        runs={runs}
        targets={targets}
      />
    )}
  </OrchestratorPageBoundary>
)
