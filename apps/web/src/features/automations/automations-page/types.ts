import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type {
  Automation,
  AutomationCommand,
  AutomationRun,
  AutomationTrigger
} from '@/server/orchestrator/automations/types'

export interface AutomationsListPageProps {
  initialApplications: AndroidApplication[]
  initialAutomations: Automation[]
}

export interface AutomationEditorPageProps {
  initialApplications: AndroidApplication[]
  initialAutomation?: Automation | null
  initialCommands: AutomationCommand[]
  initialRuns?: AutomationRun[]
  initialView?: 'builder' | 'traces'
}

export interface AutomationTriggersPageProps {
  initialApplications: AndroidApplication[]
  initialAutomations: Automation[]
  initialTriggers: AutomationTrigger[]
}
