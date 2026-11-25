import type { TriggerApplication } from '../triggers/automation-trigger-resource-options'
import type { ActionResult } from '@/shared/actions/action-result'
import type { ApplicationName } from '@/shared/contracts/application'
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
  targetApps: TriggerApplication[]
  canRun?: boolean
  canCreateApp?: boolean
  initialApplications: Array<ApplicationName & { external?: boolean }>
  initialAutomations: AutomationOption[]
  triggersPage: AutomationTriggersGridPage
  gridQuery: AutomationTriggersGridQuery
}
