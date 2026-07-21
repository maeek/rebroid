import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationsGridAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationTriggersAction } from '@/server/orchestrator/automations/automation-trigger-actions'
import { firstSearchParamValue, positiveIntegerSearchParam, validatedSearchParam } from '@/shared/model/search-params'
import type { AndroidApplication } from '@/shared/contracts/application'
import type {
  AutomationsGridPage,
  AutomationsGridQuery,
  AutomationLastStatus,
  AutomationTrigger
} from '@/shared/contracts/automation'

export type AutomationsSearchParams = Record<string, string | string[] | undefined>

const statuses = new Set<AutomationLastStatus>(['never_run', 'running', 'success', 'failed'])
const lastRuns = new Set<NonNullable<AutomationsGridQuery['lastRun']>>(['all', 'never', '7d', '30d', '90d'])

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
  return {
    page: positiveIntegerSearchParam(searchParams.page, { fallback: 1 }),
    pageSize: positiveIntegerSearchParam(searchParams.pageSize, { fallback: 20, max: 100 }),
    q: firstSearchParamValue(searchParams.q)?.trim() || undefined,
    tag: firstSearchParamValue(searchParams.tag)?.trim() || undefined,
    targetApplicationId: firstSearchParamValue(searchParams.targetApplicationId)?.trim() || undefined,
    status: validatedSearchParam(searchParams.status, statuses),
    lastRun: validatedSearchParam(searchParams.lastRun, lastRuns),
    sort: firstSearchParamValue(searchParams.sort)?.trim() || undefined
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
