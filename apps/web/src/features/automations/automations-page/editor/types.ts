import type { ActionResult } from '@/shared/actions/action-result'
import type { AndroidApplication, ApplicationName } from '@/shared/contracts/application'
import type {
  Automation,
  AutomationCommand,
  AutomationOption,
  AutomationsGridPage,
  AutomationsGridQuery,
  AutomationTriggersGridPage,
  AutomationTriggersGridQuery
} from '@/shared/contracts/automation'
import type { WorkflowHistoryRetention } from '@/shared/contracts/scheduled-task'

export interface AutomationsListPageProps {
  loading?: boolean
  initialApplications: ApplicationName[]
  automationsPage: AutomationsGridPage
  gridQuery: AutomationsGridQuery
  workflowHistoryRetention?: ActionResult<WorkflowHistoryRetention> | null
  canManageHistoryRetention?: boolean
}

export interface AutomationEditorPageProps {
  initialAutomation?: Automation | null
  draftOwnerUserId?: string
  initialCommands: AutomationCommand[]
  canUseAi: boolean
  canManageAi: boolean
}

export interface AutomationTriggersPageProps {
  loading?: boolean
  ownedAppIds?: string[]
  canRun?: boolean
  canCreateApp?: boolean
  initialApplications: AndroidApplication[]
  initialAutomations: AutomationOption[]
  triggersPage: AutomationTriggersGridPage
  gridQuery: AutomationTriggersGridQuery
}
