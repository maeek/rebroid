import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { AutomationTracesSection } from './automation-traces-section'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { Automation, AutomationRun } from '@/shared/contracts/automation'

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
        section={{ label: 'Automations' }}
        trail={[
          { label: 'Workflows', href: '/automations' },
          { label: automation.name, href: `/automations/${automation.id}` }
        ]}
        title={`${automation.name} traces`}
        description='Execution history for this workflow.'
      />
      <PageContent className='grid gap-6 pt-2'>
        <AutomationTracesSection
          applications={applications}
          runs={runs}
        />
      </PageContent>
    </StandardPage>
  )
}
