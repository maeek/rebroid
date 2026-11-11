import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { AutomationTracesPage } from '../../automations-page/traces/automation-traces-page'
import { loadAutomationTracesPageData } from './page-data.server'

export async function AutomationTracesPageEntry({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ run?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  return (
    <OrchestratorPageBoundary
      load={() => loadAutomationTracesPageData(id, query?.run)}
      fallback={requestId => (
        <PlatformRouteUnavailable
          requestId={requestId}
          title='Workflow runs'
          description='Inspect workflow execution history.'
          section={{ label: 'Automations', href: '/automations' }}
        />
      )}
    >
      {({ applications, automation, runs }) => (
        <AutomationTracesPage
          applications={applications}
          automation={automation}
          runs={runs}
          selectedRunId={query?.run}
        />
      )}
    </OrchestratorPageBoundary>
  )
}
