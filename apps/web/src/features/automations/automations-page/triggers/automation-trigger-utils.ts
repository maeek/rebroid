import { defaultSchedule, scheduleToCron } from '@/shared/model/automation-schedule'
import type { AndroidApplication, ApplicationProfileMode } from '@/shared/contracts/application'
import type { AutomationStartPolicy, AutomationTrigger } from '@/shared/contracts/automation'

export type LastRunFilter = 'all' | 'never' | '7d' | '30d' | '90d'

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

export const matchesLastRun = (trigger: AutomationTrigger, filter: LastRunFilter) => {
  if (filter === 'all') return true
  if (filter === 'never') return trigger.lastRunAt === null
  if (!trigger.lastRunAt) return false
  const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 90
  return new Date(trigger.lastRunAt).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000
}
