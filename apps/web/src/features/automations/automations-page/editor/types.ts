import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { Automation, AutomationCommand, AutomationTrigger } from '@/server/orchestrator/automations/types'

export interface AutomationsListPageProps {
  initialApplications: AndroidApplication[]
  initialAutomations: Automation[]
  initialTriggers: AutomationTrigger[]
}

export interface AutomationEditorPageProps {
  initialAutomation?: Automation | null
  initialCommands: AutomationCommand[]
}

export interface AutomationTriggersPageProps {
  initialApplications: AndroidApplication[]
  initialAutomations: Automation[]
  initialTriggers: AutomationTrigger[]
}
