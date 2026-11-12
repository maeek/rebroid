import { defaultSchedule, scheduleToCron } from '@/shared/model/automation-schedule'
import type { AndroidApplication, ApplicationProfileMode } from '@/shared/contracts/application'
import type { AutomationStartPolicy, AutomationTrigger } from '@/shared/contracts/automation'

export const appProfileMode = (app: AndroidApplication | null | undefined): ApplicationProfileMode =>
  app?.storage.profileMode ?? 'persistent'

export const appProfileName = (app: AndroidApplication | null | undefined) => app?.storage.profileName ?? 'default'

export const appSavedProfiles = (app: AndroidApplication | null | undefined) => app?.storage.savedProfiles ?? []

export const getScheduleCron = (trigger: AutomationTrigger) => {
  const cronExpression = trigger.triggerConfig.cronExpression
  return typeof cronExpression === 'string' ? cronExpression : scheduleToCron(defaultSchedule)
}

export const getStartPolicy = (trigger: AutomationTrigger): AutomationStartPolicy => {
  const startPolicy = trigger.triggerConfig.startPolicy
  return startPolicy === 'require-running' || startPolicy === 'start-if-needed' ? startPolicy : 'start-if-needed'
}
