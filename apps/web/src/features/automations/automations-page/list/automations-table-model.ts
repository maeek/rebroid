import { compactGridParams } from '../shared/grid-query-utils'
import type { Automation, AutomationsGridQuery, AutomationTrigger } from '@/server/orchestrator/automations/types'
import type { AutomationDefinitionStep } from '@rebroid/automation-core/definition'

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

export const automationStatusLabel = (status: Automation['lastStatus']) => {
  if (status === 'never_run') return 'Never run'
  return status === 'success' ? 'Success' : status === 'running' ? 'Running' : 'Failed'
}

export const countAutomationSteps = (steps: AutomationDefinitionStep[]): number =>
  steps.reduce((count, step) => {
    if ('uses' in step) return count + 1
    if (step.type === 'condition')
      return count + 1 + countAutomationSteps(step.then) + countAutomationSteps(step.else ?? [])
    if (step.type === 'switch') {
      return (
        count +
        1 +
        step.cases.reduce((sum, item) => sum + countAutomationSteps(item.steps), 0) +
        countAutomationSteps(step.default ?? [])
      )
    }
    return count + 1 + countAutomationSteps(step.steps)
  }, 0)

export const automationTriggerAppIdsByAutomationId = (triggers: AutomationTrigger[]) => {
  const map = new Map<string, Set<string>>()

  for (const trigger of triggers) {
    const set = map.get(trigger.automationId) ?? new Set<string>()
    set.add(trigger.targetApplicationId)
    map.set(trigger.automationId, set)
  }

  return map
}

export const retainPageAutomationSelection = (automations: Automation[], selectedIds: Set<string>) => {
  const currentPageIds = new Set(automations.map(automation => automation.id))

  return new Set([...selectedIds].filter(id => currentPageIds.has(id)))
}

export const selectedAutomationsFromIds = (automations: Automation[], selectedIds: Set<string>) =>
  automations.filter(automation => selectedIds.has(automation.id))

export const countActiveAutomationFilters = ({
  lastRun,
  status,
  tag,
  targetApplicationId
}: {
  lastRun?: string
  status?: string
  tag?: string
  targetApplicationId?: string
}) => [tag, targetApplicationId, status, lastRun].filter(Boolean).length

export const buildAutomationsGridHref = ({ gridQuery, pageSize, patch }: AutomationsGridHrefInput) => {
  const params = compactGridParams({
    q: patch.q ?? gridQuery.q,
    tag: patch.tag ?? gridQuery.tag,
    targetApplicationId: patch.targetApplicationId ?? gridQuery.targetApplicationId,
    status: patch.status ?? gridQuery.status,
    lastRun: patch.lastRun ?? gridQuery.lastRun,
    sort: patch.sort ?? gridQuery.sort,
    page: patch.page ?? gridQuery.page ?? 1,
    pageSize: patch.pageSize ?? gridQuery.pageSize ?? pageSize
  })

  return `/automations${params.size ? `?${params.toString()}` : ''}`
}

export const deletedAutomationIdsFromResults = (items: Automation[], results: PromiseSettledResult<unknown>[]) =>
  new Set(
    results
      .map((result, index) => (result.status === 'fulfilled' ? items[index]?.id : null))
      .filter((id): id is string => Boolean(id))
  )

export const summarizeAutomationDeleteResults = (
  items: Automation[],
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
