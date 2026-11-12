import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { workflowTraceHref } from '@/shared/model/workflow-trace-href'
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
  const isRunDetail = query?.run !== undefined
  return (
    <OrchestratorPageBoundary
      load={() => loadAutomationTracesPageData(id, query?.run)}
      fallback={requestId => (
        <PlatformRouteUnavailable
          requestId={requestId}
          title={isRunDetail ? 'Run details' : 'Run history'}
          description='Inspect workflow execution history.'
          section={{ label: 'Automations' }}
          trail={[
            { label: 'Workflows', href: '/automations' },
            { label: 'Workflow', href: `/automations/${id}` },
            ...(isRunDetail ? [{ label: 'Run history', href: workflowTraceHref(id) }] : [])
          ]}
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
