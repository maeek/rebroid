import { cronToSchedule, defaultSchedule, scheduleToCron } from '@rebroid/automation-core/schedule'
import { compactGridParams } from '../shared/grid-query-utils'
import { appProfileMode, appProfileName, getScheduleCron, getStartPolicy } from './automation-trigger-utils'
import type { TriggerFormState } from './automation-trigger-types'
import type { AndroidApplication, ApplicationProfileMode } from '@/server/orchestrator/applications/types'
import type {
  Automation,
  AutomationTrigger,
  AutomationTriggersGridQuery,
  SaveAutomationTriggerInput
} from '@/server/orchestrator/automations/types'

type TriggerGridHrefInput = {
  gridQuery: AutomationTriggersGridQuery
  pageSize: number
  patch: Partial<AutomationTriggersGridQuery>
}

type TriggerOperationToast = {
  title: string
  description?: string
  variant?: 'destructive'
}

export const defaultTriggerName = (automation: Automation | undefined, app: AndroidApplication | undefined) => {
  if (automation && app) {
    return `${automation.name} on ${app.name}`
  }

  return 'New workflow trigger'
}

export const hasActiveTriggerFilters = (query: AutomationTriggersGridQuery) =>
  Boolean(query.q || query.tag || query.targetApplicationId || query.enabled || query.status || query.lastRun)

export const activeTriggerFilterCount = (query: AutomationTriggersGridQuery) =>
  [query.tag, query.targetApplicationId, query.enabled, query.status, query.lastRun].filter(Boolean).length

export const buildAutomationTriggersGridHref = ({ gridQuery, pageSize, patch }: TriggerGridHrefInput) => {
  const params = compactGridParams({
    q: patch.q ?? gridQuery.q,
    tag: patch.tag ?? gridQuery.tag,
    targetApplicationId: patch.targetApplicationId ?? gridQuery.targetApplicationId,
    enabled: patch.enabled ?? gridQuery.enabled,
    status: patch.status ?? gridQuery.status,
    lastRun: patch.lastRun ?? gridQuery.lastRun,
    sort: patch.sort ?? gridQuery.sort,
    page: patch.page ?? gridQuery.page ?? 1,
    pageSize: patch.pageSize ?? gridQuery.pageSize ?? pageSize
  })

  return `/automations/triggers${params.size ? `?${params.toString()}` : ''}`
}

export const retainVisibleTriggerSelection = (triggers: AutomationTrigger[], selectedIds: Set<string>) => {
  const visibleIds = new Set(triggers.map(trigger => trigger.id))

  return new Set([...selectedIds].filter(id => visibleIds.has(id)))
}

export const selectedTriggersFromIds = (triggers: AutomationTrigger[], selectedIds: Set<string>) =>
  triggers.filter(trigger => selectedIds.has(trigger.id))

export const deletedTriggerIdsFromResults = (results: PromiseSettledResult<unknown>[], triggers: AutomationTrigger[]) =>
  new Set(
    results
      .map((result, index) => (result.status === 'fulfilled' ? triggers[index]?.id : null))
      .filter((id): id is string => Boolean(id))
  )

export const summarizeTriggerBulkUpdateResults = (
  results: PromiseSettledResult<unknown>[],
  enabled: boolean
): TriggerOperationToast => {
  const failedCount = results.filter(result => result.status === 'rejected').length

  if (failedCount > 0) {
    return {
      title: 'Some triggers could not be updated',
      description: `${failedCount} update request failed.`,
      variant: 'destructive'
    }
  }

  return { title: enabled ? 'Selected triggers enabled' : 'Selected triggers disabled' }
}

export const summarizeTriggerBulkDeleteResults = (
  results: PromiseSettledResult<unknown>[],
  deletedIds: Set<string>
): TriggerOperationToast => {
  const failedCount = results.length - deletedIds.size

  if (failedCount > 0) {
    return {
      title: 'Some triggers could not be deleted',
      description: `${failedCount} delete request failed.`,
      variant: 'destructive'
    }
  }

  return { title: 'Selected triggers deleted' }
}

export const newTriggerFormState = ({
  automation,
  app
}: {
  automation: Automation
  app: AndroidApplication
}): TriggerFormState => ({
  name: defaultTriggerName(automation, app),
  automationId: automation.id,
  targetApplicationId: app.id,
  profileMode: appProfileMode(app),
  profileName: appProfileName(app),
  enabled: true,
  tags: [],
  schedule: defaultSchedule,
  startPolicy: 'start-if-needed'
})

export const editTriggerFormState = ({
  trigger,
  app
}: {
  trigger: AutomationTrigger
  app: AndroidApplication | undefined
}): TriggerFormState => ({
  id: trigger.id,
  name: trigger.name,
  automationId: trigger.automationId,
  targetApplicationId: trigger.targetApplicationId,
  profileMode: (trigger.profileMode as ApplicationProfileMode | null) ?? appProfileMode(app),
  profileName: trigger.profileName ?? appProfileName(app),
  enabled: trigger.enabled,
  tags: trigger.tags,
  schedule: cronToSchedule(getScheduleCron(trigger)),
  startPolicy: getStartPolicy(trigger)
})

export const applyTriggerTargetApplication = (
  form: TriggerFormState,
  targetApplicationId: string,
  app: AndroidApplication | undefined
): TriggerFormState => ({
  ...form,
  targetApplicationId,
  profileMode: appProfileMode(app),
  profileName: appProfileName(app)
})

export const triggerFormSavePayload = (form: TriggerFormState): SaveAutomationTriggerInput => ({
  name: form.name.trim(),
  automationId: form.automationId,
  targetApplicationId: form.targetApplicationId,
  profileMode: form.profileMode,
  profileName: form.profileName.trim() || 'default',
  enabled: form.enabled,
  tags: form.tags,
  triggerType: 'schedule',
  triggerConfig: {
    cronExpression: scheduleToCron(form.schedule),
    startPolicy: form.startPolicy
  }
})
