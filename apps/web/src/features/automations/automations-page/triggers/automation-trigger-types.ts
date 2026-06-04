import type { ScheduleDraft } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'
import type { AutomationStartPolicy } from '@/server/orchestrator/automations/types'

export type TriggerFormState = {
  id?: string
  name: string
  automationId: string
  targetApplicationId: string
  profileMode: ApplicationProfileMode
  profileName: string
  enabled: boolean
  tags: string[]
  schedule: ScheduleDraft
  startPolicy: AutomationStartPolicy
}
