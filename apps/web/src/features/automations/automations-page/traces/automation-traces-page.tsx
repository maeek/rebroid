import { Skeleton } from '@/components/ui/skeleton'
import { workflowTraceHref } from '@/shared/model/workflow-trace-href'
import { AutomationRunStatusBadge } from '@/shared/ui/automation/automation-run-status-badge'
import { WorkflowRunSummaryPanel } from '@/shared/ui/automation/workflow-run-summary-panel'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { WorkflowResourceNavigation } from '../shared/workflow-resource-navigation'
import { AutomationRunTrace } from './automation-run-trace'
import { AutomationTracesSection } from './automation-traces-section'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { Automation, AutomationRun } from '@/shared/contracts/automation'

export function AutomationTracesPage({
  applications,
  automation,
  runs,
  selectedRunId,
  loading = false
}: {
  applications: AndroidApplication[]
  automation: Automation | null
  loading?: boolean
  runs: AutomationRun[]
  selectedRunId?: string
}) {
  const selectedRun = runs.find(run => run.id === selectedRunId)
  const historyHref = automation ? workflowTraceHref(automation.id) : '/automations'
  const trail = [
    { label: 'Workflows', href: '/automations' },
    { label: automation?.name ?? 'Workflow', href: automation ? `/automations/${automation.id}` : undefined }
  ]
  if (selectedRunId !== undefined) {
    const runLabel = selectedRun ? `Run ${selectedRun.id.slice(0, 8)}` : 'Run details'
    return (
      <StandardPage>
        <PageHeader
          section={{ label: 'Automations' }}
          trail={[...trail, { label: 'Run history', href: historyHref }]}
          title={
            selectedRun ? (
              <span className='flex flex-wrap items-center gap-3'>
                {runLabel}
                <AutomationRunStatusBadge
                  runId={selectedRun.id}
                  status={selectedRun.status}
                />
              </span>
            ) : (
              runLabel
            )
          }
          breadcrumbLabel={runLabel}
          description={automation?.name}
        />
        <PageContent>
          {loading ? (
            <WorkflowRunSummaryPanel
              loading
              fields={['Run ID', 'Target app', 'Profile', 'Trigger', 'Created', 'Started', 'Finished', 'Duration'].map(
                label => ({ label, value: null })
              )}
            />
          ) : null}
          {selectedRun ? (
            <AutomationRunTrace
              key={selectedRun.id}
              run={selectedRun}
              targetName={applications.find(app => app.id === selectedRun.targetApplicationId)?.name}
            />
          ) : null}
          {!loading && !selectedRun ? (
            <StateView
              kind='not-found'
              title='Workflow run unavailable'
              description='This run could not be found in this workflow.'
              actions={[{ label: 'Run history', href: historyHref }]}
            />
          ) : null}
        </PageContent>
      </StandardPage>
    )
  }
  return (
    <StandardPage
      gridToolbar
      className='gap-0'
    >
      <PageHeader
        section={{ label: 'Automations' }}
        trail={trail}
        title={loading ? <Skeleton className='h-9 w-64 max-w-full max-sm:h-7' /> : `${automation?.name} run history`}
        breadcrumbLabel='Run history'
      />
      <PageContent className='grid gap-6 pt-2'>
        <WorkflowResourceNavigation
          workflowId={automation?.id}
          active='history'
          loading={loading}
        />
        <AutomationTracesSection
          loading={loading}
          applications={applications}
          runs={runs}
          workflowId={automation?.id}
        />
      </PageContent>
    </StandardPage>
  )
}
