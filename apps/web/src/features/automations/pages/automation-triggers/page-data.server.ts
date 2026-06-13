import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationsAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationTriggersGridAction } from '@/server/orchestrator/automations/automation-trigger-actions'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type {
  Automation,
  AutomationLastStatus,
  AutomationTriggersGridPage,
  AutomationTriggersGridQuery
} from '@/server/orchestrator/automations/types'

export type AutomationTriggersSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const statuses = new Set<AutomationLastStatus>(['never_run', 'running', 'success', 'failed'])
const lastRuns = new Set(['all', 'never', '7d', '30d', '90d'])
const enabledValues = new Set(['true', 'false'])

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

const emptyAutomationTriggersGridPage = (gridQuery: AutomationTriggersGridQuery): AutomationTriggersGridPage => ({
  items: [],
  total: 0,
  page: gridQuery.page ?? 1,
  pageSize: gridQuery.pageSize ?? 20,
  facets: {
    tags: [],
    targetApplicationIds: []
  }
})

export const triggersGridQueryFromSearchParams = (
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

export const loadAutomationTriggersPageData = async (searchParams: AutomationTriggersSearchParams) => {
  const gridQuery = triggersGridQueryFromSearchParams(searchParams)
  let orchestratorError: string | null = null
  const captureError = (error: unknown) => {
    orchestratorError ??= errorMessage(error)
  }

  const [applications, automations, triggersPage] = await Promise.all([
    listApplicationsAction({ reconcile: false }).catch(error => {
      captureError(error)
      return [] as AndroidApplication[]
    }),
    listAutomationsAction().catch(error => {
      captureError(error)
      return [] as Automation[]
    }),
    listAutomationTriggersGridAction(gridQuery).catch(error => {
      captureError(error)
      return emptyAutomationTriggersGridPage(gridQuery)
    })
  ])

  return {
    applications,
    automations,
    gridQuery,
    orchestratorError,
    triggersPage
  }
}
