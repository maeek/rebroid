import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationsGridAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationTriggersAction } from '@/server/orchestrator/automations/automation-trigger-actions'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type {
  AutomationsGridPage,
  AutomationsGridQuery,
  AutomationLastStatus,
  AutomationTrigger
} from '@/server/orchestrator/automations/types'

export type AutomationsSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const statuses = new Set<AutomationLastStatus>(['never_run', 'running', 'success', 'failed'])
const lastRuns = new Set(['all', 'never', '7d', '30d', '90d'])

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

const emptyAutomationsGridPage = (gridQuery: AutomationsGridQuery): AutomationsGridPage => ({
  items: [],
  total: 0,
  page: gridQuery.page ?? 1,
  pageSize: gridQuery.pageSize ?? 20,
  facets: {
    tags: [],
    targetApplicationIds: []
  }
})

export const automationsGridQueryFromSearchParams = (searchParams: AutomationsSearchParams): AutomationsGridQuery => {
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

export const loadAutomationsListPageData = async (searchParams: AutomationsSearchParams) => {
  const gridQuery = automationsGridQueryFromSearchParams(searchParams)
  let orchestratorError: string | null = null
  const captureError = (error: unknown) => {
    orchestratorError ??= errorMessage(error)
  }

  const [automationsPage, applications, triggers] = await Promise.all([
    listAutomationsGridAction(gridQuery).catch(error => {
      captureError(error)
      return emptyAutomationsGridPage(gridQuery)
    }),
    listApplicationsAction().catch(error => {
      captureError(error)
      return [] as AndroidApplication[]
    }),
    listAutomationTriggersAction().catch(error => {
      captureError(error)
      return [] as AutomationTrigger[]
    })
  ])

  return {
    applications,
    automationsPage,
    gridQuery,
    orchestratorError,
    triggers
  }
}
