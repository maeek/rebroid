import { Suspense } from 'react'
import { AutomationsListPageSkeleton } from '../../automations-page/automation-page-skeletons'
import { AutomationsListPage } from '../../automations-page/list/automations-list-page'
import { loadAutomationsListPageData, type AutomationsSearchParams } from './page-data.server'

const AutomationsListPageContent = async ({ searchParams }: { searchParams?: Promise<AutomationsSearchParams> }) => {
  const { applications, automationsPage, gridQuery, triggers } = await loadAutomationsListPageData(
    (await searchParams) ?? {}
  )

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
