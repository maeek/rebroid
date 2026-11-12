import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ActiveWorkflowRunsGrid } from './active-workflow-runs-grid'
import type { ActiveWorkflowRun } from '@/shared/contracts/active-workflow-run'

export const activeWorkflowRunsTitle = 'Active workflow runs'
export const activeWorkflowRunsDescription = 'Queued and running executions across your workflows.'
export const activeWorkflowRunsTrail = [{ label: 'Workflows', href: '/automations' }]

export const ActiveWorkflowRunsPage = ({
  runs = [],
  targets = {},
  loading = false
}: {
  runs?: ActiveWorkflowRun[]
  targets?: Record<string, string>
  loading?: boolean
}) => (
  <StandardPage gridToolbar>
    <PageHeader
      title={activeWorkflowRunsTitle}
      description={activeWorkflowRunsDescription}
      section={{ label: 'Automations' }}
      trail={activeWorkflowRunsTrail}
    />
    <PageContent>
      <ActiveWorkflowRunsGrid
        runs={runs}
        targets={targets}
        loading={loading}
      />
    </PageContent>
  </StandardPage>
)
