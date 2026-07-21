import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationsAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationTriggersGridAction } from '@/server/orchestrator/automations/automation-trigger-actions'
import { firstSearchParamValue, positiveIntegerSearchParam, validatedSearchParam } from '@/shared/model/search-params'
import type { AndroidApplication } from '@/shared/contracts/application'
import type {
  Automation,
  AutomationLastStatus,
  AutomationTriggersGridPage,
  AutomationTriggersGridQuery
} from '@/shared/contracts/automation'

export type AutomationTriggersSearchParams = Record<string, string | string[] | undefined>

const statuses = new Set<AutomationLastStatus>(['never_run', 'running', 'success', 'failed'])
const lastRuns = new Set<NonNullable<AutomationTriggersGridQuery['lastRun']>>(['all', 'never', '7d', '30d', '90d'])
const enabledValues = new Set<NonNullable<AutomationTriggersGridQuery['enabled']>>(['true', 'false'])

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
  return {
    page: positiveIntegerSearchParam(searchParams.page, { fallback: 1 }),
    pageSize: positiveIntegerSearchParam(searchParams.pageSize, { fallback: 20, max: 100 }),
    q: firstSearchParamValue(searchParams.q)?.trim() || undefined,
    tag: firstSearchParamValue(searchParams.tag)?.trim() || undefined,
    targetApplicationId: firstSearchParamValue(searchParams.targetApplicationId)?.trim() || undefined,
    enabled: validatedSearchParam(searchParams.enabled, enabledValues),
    status: validatedSearchParam(searchParams.status, statuses),
    lastRun: validatedSearchParam(searchParams.lastRun, lastRuns),
    sort: firstSearchParamValue(searchParams.sort)?.trim() || undefined
  }
}

export const loadAutomationTriggersPageData = async (searchParams: AutomationTriggersSearchParams) => {
  const gridQuery = triggersGridQueryFromSearchParams(searchParams)
  let orchestratorError: string | null = null
  const captureError = (error: unknown) => {
    orchestratorError ??= errorMessage(error)
  }

  const [applications, automations, triggersPage] = await Promise.all([
    listApplicationsAction().catch(error => {
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
