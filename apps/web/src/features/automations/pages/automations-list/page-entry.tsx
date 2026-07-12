import { Suspense } from 'react'
import { AutomationsListPageSkeleton } from '../../automations-page/automation-page-skeletons'
import { AutomationsListPage } from '../../automations-page/list/automations-list-page'
import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { loadAutomationsListPageData, type AutomationsSearchParams } from './page-data.server'

const AutomationsListPageContent = async ({ searchParams }: { searchParams?: Promise<AutomationsSearchParams> }) => {
  const { applications, automationsPage, gridQuery, orchestratorError, triggers } = await loadAutomationsListPageData(
    (await searchParams) ?? {}
  )

  if (orchestratorError) {
    return (
      <AutomationPageUnavailable
        title='Workflows'
        href='/automations'
      />
    )
  }

  return (
    <AutomationsListPage
      initialApplications={applications}
      automationsPage={automationsPage}
      gridQuery={gridQuery}
      initialTriggers={triggers}
    />
  )
}

export function AutomationsListPageEntry({ searchParams }: { searchParams?: Promise<AutomationsSearchParams> }) {
  return (
    <Suspense fallback={<AutomationsListPageSkeleton />}>
      <AutomationsListPageContent searchParams={searchParams} />
    </Suspense>
  )
}
