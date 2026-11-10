import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { WorkflowResourceNavigation } from '../shared/workflow-resource-navigation'
import { AutomationTracesSection } from './automation-traces-section'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { Automation, AutomationRun } from '@/shared/contracts/automation'

export function AutomationTracesPage({
  applications,
  automation,
  runs,
  loading = false
}: {
  applications: AndroidApplication[]
  automation: Automation | null
  loading?: boolean
  runs: AutomationRun[]
}) {
  return (
    <StandardPage className='gap-0'>
      <PageHeader
        section={{ label: 'Automations' }}
        trail={[
          { label: 'Workflows', href: '/automations' },
          { label: automation?.name ?? 'Workflow', href: automation ? `/automations/${automation.id}` : undefined }
        ]}
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
        />
      </PageContent>
    </StandardPage>
  )
}
