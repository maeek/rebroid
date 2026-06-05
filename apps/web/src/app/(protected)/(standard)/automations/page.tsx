import { AutomationsListPage } from '@/features/automations/automations-page/list/automations-list-page'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationTriggersAction, listAutomationsGridAction } from '@/server/orchestrator/automations/actions'
import type { AutomationsGridQuery, AutomationLastStatus } from '@/server/orchestrator/automations/types'

type AutomationsSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const statuses = new Set<AutomationLastStatus>(['never_run', 'running', 'success', 'failed'])
const lastRuns = new Set(['all', 'never', '7d', '30d', '90d'])

const automationsGridQueryFromSearchParams = (searchParams: AutomationsSearchParams): AutomationsGridQuery => {
  const status = firstValue(searchParams.status)
  const lastRun = firstValue(searchParams.lastRun)
  return {
    page: Math.max(Number(firstValue(searchParams.page)) || 1, 1),
    pageSize: Math.min(Math.max(Number(firstValue(searchParams.pageSize)) || 20, 1), 100),
    q: firstValue(searchParams.q)?.trim() || undefined,
    tag: firstValue(searchParams.tag)?.trim() || undefined,
    targetApplicationId: firstValue(searchParams.targetApplicationId)?.trim() || undefined,
    status: statuses.has(status as AutomationLastStatus) ? (status as AutomationLastStatus) : undefined,
    lastRun: lastRuns.has(lastRun ?? '') ? (lastRun as AutomationsGridQuery['lastRun']) : undefined,
    sort: firstValue(searchParams.sort)?.trim() || undefined
  }
}

export default async function AutomationsRoute({ searchParams }: { searchParams?: Promise<AutomationsSearchParams> }) {
  const gridQuery = automationsGridQueryFromSearchParams((await searchParams) ?? {})
  const [automationsPage, applications, triggers] = await Promise.all([
    listAutomationsGridAction(gridQuery),
    listApplicationsAction({ reconcile: false }),
    listAutomationTriggersAction()
  ])

  return (
    <AutomationsListPage
      initialApplications={applications}
      automationsPage={automationsPage}
      gridQuery={gridQuery}
      initialTriggers={triggers}
    />
  )
}
