import type { AutomationGridRow } from '@/shared/contracts/automation'

type AutomationOperationToast = {
  title: string
  description?: string
  variant?: 'danger'
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
