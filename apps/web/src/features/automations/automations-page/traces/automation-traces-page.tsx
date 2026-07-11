import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { AutomationTracesSection } from './automation-traces-section'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { Automation, AutomationRun } from '@/server/orchestrator/automations/types'

export function AutomationTracesPage({
  applications,
  automation,
  runs
}: {
  applications: AndroidApplication[]
  automation: Automation
  runs: AutomationRun[]
}) {
  return (
    <StandardPage className='gap-0'>
      <PageHeader
        breadcrumbs={[
          { label: 'Automations' },
          { label: 'Workflows', href: '/automations' },
          { label: automation.name, href: `/automations/${automation.id}` },
          { label: 'Traces' }
        ]}
        title={`${automation.name} traces`}
        description='Execution history for this workflow.'
      />
      <section className='grid gap-6 px-6 pb-16 pt-2 max-sm:px-4'>
        <AutomationTracesSection
          applications={applications}
          runs={runs}
        />
      </section>
    </StandardPage>
  )
}
