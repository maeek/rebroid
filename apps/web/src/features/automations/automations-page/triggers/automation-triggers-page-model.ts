import { cronToSchedule, defaultSchedule, scheduleToCron } from '@/shared/model/automation-schedule'
import { appProfileMode, appProfileName, getScheduleCron, getStartPolicy } from './automation-trigger-utils'
import type { TriggerFormState } from './automation-trigger-types'
import type { AndroidApplication, ApplicationProfileMode } from '@/shared/contracts/application'
import type { AutomationOption, AutomationTrigger, SaveAutomationTriggerInput } from '@/shared/contracts/automation'

type TriggerOperationToast = {
  title: string
  description?: string
  variant: 'danger' | 'success'
}

export const defaultTriggerName = (automation: AutomationOption | undefined, app: AndroidApplication | undefined) => {
  if (automation && app) {
    return `${automation.name} on ${app.name}`.slice(0, 120)
  }

  return 'New workflow trigger'
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
      variant: 'danger'
    }
  }

  return { title: enabled ? 'Selected triggers enabled' : 'Selected triggers disabled', variant: 'success' }
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
      variant: 'danger'
    }
  }

  return { title: 'Selected triggers deleted', variant: 'success' }
}

export const newTriggerFormState = ({
  automation,
  app
}: {
  automation: AutomationOption
  app: AndroidApplication
}): TriggerFormState => ({
  name: defaultTriggerName(automation, app),
  description: '',
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
  description: trigger.description ?? '',
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
  app: AndroidApplication | undefined,
  workflow?: AutomationOption,
  previousApp?: AndroidApplication
): TriggerFormState => ({
  ...form,
  name:
    !form.id && workflow && form.name === defaultTriggerName(workflow, previousApp)
      ? defaultTriggerName(workflow, app)
      : form.name,
  targetApplicationId,
  profileMode: appProfileMode(app),
  profileName: appProfileName(app)
})

export const applyTriggerWorkflow = (
  form: TriggerFormState,
  workflow: AutomationOption | undefined,
  previousWorkflow: AutomationOption | undefined,
  app: AndroidApplication | undefined
): TriggerFormState => ({
  ...form,
  automationId: workflow?.id ?? '',
  name:
    !form.id && app && form.name === defaultTriggerName(previousWorkflow, app)
      ? defaultTriggerName(workflow, app)
      : form.name
})

export const triggerFormSavePayload = (form: TriggerFormState) =>
  ({
    name: form.name.trim(),
    description: form.description.trim() || null,
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
  }) satisfies SaveAutomationTriggerInput

export const triggerFormUpdatePayload = (
  form: TriggerFormState,
  baseline: TriggerFormState
): Partial<SaveAutomationTriggerInput> => {
  const next = triggerFormSavePayload(form)
  const previous = triggerFormSavePayload(baseline)
  const { cronExpression, startPolicy } = next.triggerConfig
  const triggerConfig = {
    ...(cronExpression !== previous.triggerConfig.cronExpression && { cronExpression }),
    ...(startPolicy !== previous.triggerConfig.startPolicy && { startPolicy })
  }
  return {
    ...(next.name !== previous.name && { name: next.name }),
    ...(next.description !== previous.description && { description: next.description }),
    ...(next.automationId !== previous.automationId && { automationId: next.automationId }),
    ...(next.targetApplicationId !== previous.targetApplicationId && { targetApplicationId: next.targetApplicationId }),
    ...(next.profileMode !== previous.profileMode && { profileMode: next.profileMode }),
    ...(next.profileName !== previous.profileName && { profileName: next.profileName }),
    ...(next.enabled !== previous.enabled && { enabled: next.enabled }),
    ...(JSON.stringify(next.tags) !== JSON.stringify(previous.tags) && { tags: next.tags }),
    ...(Object.keys(triggerConfig).length > 0 && { triggerConfig })
  }
}
