import { Suspense } from 'react'
import { AutomationsListPage } from '../../automations-page/list/automations-list-page'
import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { loadAutomationsListPageData, type AutomationsSearchParams } from './page-data.server'
import { AutomationsListPageLoading } from './page-loading'

const AutomationsListPageContent = async ({ searchParams }: { searchParams?: Promise<AutomationsSearchParams> }) => {
  const { applications, automationsPage, gridQuery, orchestratorError, triggers, workflowHistoryRetention } =
    await loadAutomationsListPageData((await searchParams) ?? {})

  if (orchestratorError) {
    return <AutomationPageUnavailable title='Workflows' />
  }

  return (
    <AutomationsListPage
      initialApplications={applications}
      automationsPage={automationsPage}
      gridQuery={gridQuery}
      initialTriggers={triggers}
      workflowHistoryRetention={workflowHistoryRetention}
    />
  )
}

export function AutomationsListPageEntry({ searchParams }: { searchParams?: Promise<AutomationsSearchParams> }) {
  return (
    <Suspense fallback={<AutomationsListPageLoading />}>
      <AutomationsListPageContent searchParams={searchParams} />
    </Suspense>
  )
}
