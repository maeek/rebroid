import { Suspense } from 'react'
import { AutomationsListPage } from '../../automations-page/list/automations-list-page'
import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { loadAutomationsListPageData } from './page-data.server'
import { AutomationsListPageLoading } from './page-loading'
import type { WorkflowGridSearchParams } from '../workflow-grid-query'

const AutomationsListPageContent = async ({ searchParams }: { searchParams?: Promise<WorkflowGridSearchParams> }) => {
  const result = await loadAutomationsListPageData((await searchParams) ?? {})
  if (!result.ok)
    return (
      <AutomationPageUnavailable
        title='Workflows'
        requestId={result.requestId}
      />
    )
  const { applications, automationsPage, gridQuery, workflowHistoryRetention } = result.data

  return (
    <AutomationsListPage
      initialApplications={applications}
      automationsPage={automationsPage}
      gridQuery={gridQuery}
      workflowHistoryRetention={workflowHistoryRetention}
    />
  )
}

export function AutomationsListPageEntry({ searchParams }: { searchParams?: Promise<WorkflowGridSearchParams> }) {
  return (
    <Suspense fallback={<AutomationsListPageLoading />}>
      <AutomationsListPageContent searchParams={searchParams} />
    </Suspense>
  )
}
