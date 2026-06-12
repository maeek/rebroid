import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'
import type { AutomationStartPolicy } from '@/server/orchestrator/automations/types'
import type { AutomationTag } from '@rebroid/automation-core/definition'
import type { ScheduleDraft } from '@rebroid/automation-core/schedule'

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
