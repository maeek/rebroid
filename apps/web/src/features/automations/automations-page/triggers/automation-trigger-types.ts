import type { ApplicationProfileMode } from '@/shared/contracts/application'
import type { AutomationStartPolicy } from '@/shared/contracts/automation'
import type { ScheduleDraft } from '@/shared/model/automation-schedule'
import type { AutomationTag } from '@rebroid/automation-core/definition'

export type TriggerFormState = {
  id?: string
  name: string
  automationId: string
  targetApplicationId: string
  profileMode: ApplicationProfileMode
  profileName: string
  enabled: boolean
  tags: AutomationTag[]
  schedule: ScheduleDraft
  startPolicy: AutomationStartPolicy
}
