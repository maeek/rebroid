import { defaultSchedule, scheduleToCron } from '@/shared/model/automation-schedule'
import type { TriggerApplication } from './automation-trigger-resource-options'
import type { ApplicationProfileMode } from '@/shared/contracts/application'
import type { AutomationStartPolicy, AutomationTrigger } from '@/shared/contracts/automation'

export const appProfileMode = (app: TriggerApplication | null | undefined): ApplicationProfileMode =>
  (app && 'storage' in app ? app.storage.profileMode : undefined) ?? 'persistent'

export const appProfileName = (app: TriggerApplication | null | undefined) =>
  (app && 'storage' in app ? app.storage.profileName : undefined) ?? 'default'

export const appSavedProfiles = (app: TriggerApplication | null | undefined) =>
  (app && 'storage' in app ? app.storage.savedProfiles : undefined) ?? []

export const getScheduleCron = (trigger: AutomationTrigger) => {
  const cronExpression = trigger.triggerConfig.cronExpression
  return typeof cronExpression === 'string' ? cronExpression : scheduleToCron(defaultSchedule)
}

export const getStartPolicy = (trigger: AutomationTrigger): AutomationStartPolicy => {
  const startPolicy = trigger.triggerConfig.startPolicy
  return startPolicy === 'require-running' || startPolicy === 'start-if-needed' ? startPolicy : 'start-if-needed'
}
