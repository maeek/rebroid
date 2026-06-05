import { AutomationTriggersPage } from '@/features/automations/automations-page/triggers/automation-triggers-page'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationTriggersGridAction, listAutomationsAction } from '@/server/orchestrator/automations/actions'
import type { AutomationLastStatus, AutomationTriggersGridQuery } from '@/server/orchestrator/automations/types'

type AutomationTriggersSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const statuses = new Set<AutomationLastStatus>(['never_run', 'running', 'success', 'failed'])
const lastRuns = new Set(['all', 'never', '7d', '30d', '90d'])
const enabledValues = new Set(['true', 'false'])

const triggersGridQueryFromSearchParams = (
  searchParams: AutomationTriggersSearchParams
): AutomationTriggersGridQuery => {
  const status = firstValue(searchParams.status)
  const lastRun = firstValue(searchParams.lastRun)
  const enabled = firstValue(searchParams.enabled)
  return {
    page: Math.max(Number(firstValue(searchParams.page)) || 1, 1),
    pageSize: Math.min(Math.max(Number(firstValue(searchParams.pageSize)) || 20, 1), 100),
    q: firstValue(searchParams.q)?.trim() || undefined,
    tag: firstValue(searchParams.tag)?.trim() || undefined,
    targetApplicationId: firstValue(searchParams.targetApplicationId)?.trim() || undefined,
    enabled: enabledValues.has(enabled ?? '') ? (enabled as AutomationTriggersGridQuery['enabled']) : undefined,
    status: statuses.has(status as AutomationLastStatus) ? (status as AutomationLastStatus) : undefined,
    lastRun: lastRuns.has(lastRun ?? '') ? (lastRun as AutomationTriggersGridQuery['lastRun']) : undefined,
    sort: firstValue(searchParams.sort)?.trim() || undefined
  }
}

export default async function AutomationTriggersRoute({
  searchParams
}: {
  searchParams?: Promise<AutomationTriggersSearchParams>
}) {
  const gridQuery = triggersGridQueryFromSearchParams((await searchParams) ?? {})
  const [applications, automations, triggersPage] = await Promise.all([
    listApplicationsAction({ reconcile: false }),
    listAutomationsAction(),
    listAutomationTriggersGridAction(gridQuery)
  ])

  return (
    <AutomationTriggersPage
      initialApplications={applications}
      initialAutomations={automations}
      triggersPage={triggersPage}
      gridQuery={gridQuery}
    />
  )
}
