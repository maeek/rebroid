import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { Automation, AutomationCommand, AutomationRun } from '@/server/orchestrator/automations/types'

export interface AutomationsListPageProps {
  initialApplications: AndroidApplication[]
  initialAutomations: Automation[]
}

export interface AutomationEditorPageProps {
  initialApplications: AndroidApplication[]
  initialAutomation?: Automation | null
  initialCommands: AutomationCommand[]
  initialRuns?: AutomationRun[]
}

export interface AutomationRunState {
  automationId: string
  runs: AutomationRun[]
}
