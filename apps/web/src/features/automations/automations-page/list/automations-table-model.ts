import { compactGridParams } from '../shared/grid-query-utils'
import type { AutomationGridRow, AutomationsGridQuery } from '@/shared/contracts/automation'

type AutomationsGridHrefInput = {
  gridQuery: AutomationsGridQuery
  pageSize: number
  patch: Partial<AutomationsGridQuery>
}

type AutomationOperationToast = {
  title: string
  description?: string
  variant?: 'danger'
}

export const retainPageAutomationSelection = (automations: AutomationGridRow[], selectedIds: Set<string>) => {
  const currentPageIds = new Set(automations.map(automation => automation.id))

  return new Set([...selectedIds].filter(id => currentPageIds.has(id)))
}

export const selectedAutomationsFromIds = (automations: AutomationGridRow[], selectedIds: Set<string>) =>
  automations.filter(automation => selectedIds.has(automation.id))

export const buildAutomationsGridHref = ({ gridQuery, pageSize, patch }: AutomationsGridHrefInput) => {
  const params = compactGridParams({
    ...gridQuery,
    ...patch,
    page: patch.page ?? gridQuery.page ?? 1,
    pageSize: patch.pageSize ?? gridQuery.pageSize ?? pageSize
  })

  return `/automations${params.size ? `?${params.toString()}` : ''}`
}

export const deletedAutomationIdsFromResults = (items: AutomationGridRow[], results: PromiseSettledResult<unknown>[]) =>
  new Set(
    results
      .map((result, index) => (result.status === 'fulfilled' ? items[index]?.id : null))
      .filter((id): id is string => Boolean(id))
  )

export const summarizeAutomationDeleteResults = (
  items: AutomationGridRow[],
  deletedIds: Set<string>,
  results: PromiseSettledResult<unknown>[]
): AutomationOperationToast => {
  const failedCount = results.length - deletedIds.size

  if (failedCount > 0) {
    return {
      title: 'Some workflows could not be deleted',
      description: `${failedCount} delete request failed.`,
      variant: 'danger'
    }
  }

  return { title: items.length === 1 ? 'Workflow deleted' : 'Selected workflows deleted' }
}
