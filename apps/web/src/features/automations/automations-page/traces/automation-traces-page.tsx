import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
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
    <ProtectedStackPageLayout mainClassName='gap-0'>
      <section className='shrink-0 px-6 py-4 max-sm:px-4'>
        <div className='grid gap-3'>
          <PageBreadcrumbs
            className='pt-0'
            items={[
              { label: 'Automations' },
              { label: 'Workflows', href: '/automations' },
              { label: automation.name, href: `/automations/${automation.id}` },
              { label: 'Traces' }
            ]}
          />
          <div className='grid gap-2'>
            <h2 className='min-w-0 truncate text-3xl font-medium max-sm:text-xl'>{automation.name} traces</h2>
            <p className='max-w-3xl text-sm text-secondary-foreground'>Execution history for this workflow.</p>
          </div>
        </div>
      </section>
      <section className='grid gap-6 px-6 pb-16 pt-2 max-sm:px-4'>
        <AutomationTracesSection
          applications={applications}
          runs={runs}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
