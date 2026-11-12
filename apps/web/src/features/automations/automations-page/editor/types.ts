import type { AndroidApplication } from '@/shared/contracts/application'
import type {
  Automation,
  AutomationCommand,
  AutomationsGridPage,
  AutomationsGridQuery,
  AutomationTriggersGridPage,
  AutomationTriggersGridQuery,
  AutomationTrigger
} from '@/shared/contracts/automation'

export interface AutomationsListPageProps {
  loading?: boolean
  initialApplications: AndroidApplication[]
  automationsPage: AutomationsGridPage
  gridQuery: AutomationsGridQuery
  initialTriggers: AutomationTrigger[]
}

export interface AutomationEditorPageProps {
  initialAutomation?: Automation | null
  initialCommands: AutomationCommand[]
  canUseAi: boolean
  canManageAi: boolean
}

export interface AutomationTriggersPageProps {
  loading?: boolean
  initialApplications: AndroidApplication[]
  initialAutomations: Automation[]
  triggersPage: AutomationTriggersGridPage
  gridQuery: AutomationTriggersGridQuery
}
