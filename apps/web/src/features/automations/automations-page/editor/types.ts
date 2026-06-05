import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type {
  Automation,
  AutomationCommand,
  AutomationsGridPage,
  AutomationsGridQuery,
  AutomationTriggersGridPage,
  AutomationTriggersGridQuery,
  AutomationTrigger
} from '@/server/orchestrator/automations/types'

export interface AutomationsListPageProps {
  initialApplications: AndroidApplication[]
  automationsPage: AutomationsGridPage
  gridQuery: AutomationsGridQuery
  initialTriggers: AutomationTrigger[]
}

export interface AutomationEditorPageProps {
  initialAutomation?: Automation | null
  initialCommands: AutomationCommand[]
}

export interface AutomationTriggersPageProps {
  initialApplications: AndroidApplication[]
  initialAutomations: Automation[]
  triggersPage: AutomationTriggersGridPage
  gridQuery: AutomationTriggersGridQuery
}
