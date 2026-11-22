import { firstSearchParamValue, paginationFromSearchParams, validatedSearchParam } from '@/shared/model/search-params'
import type { AutomationsGridQuery, AutomationLastStatus } from '@/shared/contracts/automation'

export type WorkflowGridSearchParams = Record<string, string | string[] | undefined>

const statuses = new Set<AutomationLastStatus>(['never_run', 'running', 'success', 'failed'])
const lastRuns = new Set<NonNullable<AutomationsGridQuery['lastRun']>>(['all', 'never', '7d', '30d', '90d'])

export const workflowGridQueryFromSearchParams = (searchParams: WorkflowGridSearchParams) =>
  ({
    ...paginationFromSearchParams(searchParams),
    q: firstSearchParamValue(searchParams.q)?.trim() || undefined,
    tag: firstSearchParamValue(searchParams.tag)?.trim() || undefined,
    targetApplicationId: firstSearchParamValue(searchParams.targetApplicationId)?.trim() || undefined,
    status: validatedSearchParam(searchParams.status, statuses),
    lastRun: validatedSearchParam(searchParams.lastRun, lastRuns),
    sort: firstSearchParamValue(searchParams.sort)?.trim() || undefined
  }) satisfies AutomationsGridQuery
