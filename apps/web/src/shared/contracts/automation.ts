import type { AutomationCommandEditorMetadata } from '@rebroid/automation-core/command-registry'
import type { AutomationCommandOutput, AutomationDefinition, AutomationTag } from '@rebroid/automation-core/definition'
import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type AutomationLastStatus = 'never_run' | 'success' | 'failed' | 'running'
export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled'
export type AutomationRunTrigger = 'manual' | 'schedule'
export type AutomationTriggerType = 'schedule'
export type AutomationStartPolicy = 'require-running' | 'start-if-needed'

export interface Automation {
  id: string
  ownerUserId: string
  name: string
  description: string | null
  tags: AutomationTag[]
  definition: AutomationDefinition
  yaml: string
  lastRunAt: string | null
  lastRunId?: string | null
  lastStatus: AutomationLastStatus
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export type AutomationGridRow = OrchestratorApiSchemas['AutomationGridRowDto']
export type AutomationsGridPage = OrchestratorApiSchemas['AutomationsGridPageDto']
export type AutomationOption = OrchestratorApiSchemas['AutomationOptionDto']
export type RunnableAutomationOption = OrchestratorApiSchemas['RunnableAutomationOptionDto']

export type AutomationsGridLastRunFilter = 'all' | 'never' | '7d' | '30d' | '90d'

export interface AutomationsGridQuery {
  page?: number
  pageSize?: number
  q?: string
  tag?: string
  targetDeviceId?: string
  status?: AutomationLastStatus
  lastRun?: AutomationsGridLastRunFilter
  sort?: string
}

export interface AutomationTriggersGridQuery extends AutomationsGridQuery {
  enabled?: 'true' | 'false'
}

export interface AutomationTriggersGridPage {
  items: AutomationTrigger[]
  total: number
  page: number
  pageSize: number
  facets: {
    tags: string[]
    targetDeviceIds: string[]
  }
}

export interface AutomationCommand {
  uses: string
  label: string
  description: string
  requiredPermissions: string[]
  inputSchema: Record<string, unknown>
  outputs: AutomationCommandOutput[]
  editor: AutomationCommandEditorMetadata
}

export interface AutomationStepResult {
  stepId: string
  uses: string
  parentStepId?: string | null
  path?: string
  status: 'success' | 'failed' | 'skipped'
  startedAt: string
  completedAt: string
  output: Record<string, unknown> | null
  error: string | null
}

export type AutomationRunHistoryRow = OrchestratorApiSchemas['AutomationRunHistoryRowDto']

export interface AutomationRun {
  id: string
  automationId: string
  automationTriggerId: string | null
  ownerUserId: string
  targetDeviceId: string
  targetKind?: 'managed' | 'external'
  targetAttachmentId?: string | null
  targetProfileMode: string | null
  targetProfileName: string | null
  trigger: AutomationRunTrigger
  status: AutomationRunStatus
  startedAt: string | null
  completedAt: string | null
  stepResults: AutomationStepResult[]
  failureRequestId?: string
  failureCode?: string
  error: string | null
  createdAt: string
  updatedAt: string
}

export type SaveAutomationInput = Pick<OrchestratorApiSchemas['CreateAutomationDto'], 'yaml'>

export interface RunAutomationInput {
  targetDeviceId: string
  attachmentId?: string
  profileMode?: string | null
  profileName?: string | null
  startPolicy?: AutomationStartPolicy
}

export interface RunAdHocAiAutomationInput extends RunAutomationInput {
  prompt: string
  conversation?: Array<{ role: 'user' | 'assistant'; content: string }>
  providerId?: string
  modelId?: string
  visionProviderId?: string
  visionModelId?: string
  clientMessageId?: string
  capabilities?: string[]
  agentMode?: 'adaptive' | 'controller' | 'planned'
  rawShellPolicy?: 'deny' | 'allowlisted'
  maxActions?: number
  timeoutMs?: number
}

export type SuggestAdHocAiPromptsInput = Omit<
  OrchestratorApiSchemas['SuggestAdHocAiPromptsDto'],
  'ownerUserId' | 'profileMode'
> & {
  profileMode?: string | null
}

export type AiPromptSuggestion = OrchestratorApiSchemas['AiPromptSuggestionDto']
export type AiPromptSuggestions = OrchestratorApiSchemas['AiPromptSuggestionsDto']
export type DraftAutomationYamlInput = OrchestratorApiSchemas['DraftAutomationYamlDto']

export type AutomationRunEvent = OrchestratorApiSchemas['AutomationRunEventDto']
export type AutomationRunEventType = AutomationRunEvent['type']
export type AutomationRunEventPage = OrchestratorApiSchemas['AutomationRunEventPageDto']
export type AutomationRunEventStreamToken = OrchestratorApiSchemas['AutomationRunEventStreamTokenDto']

export interface AutomationTrigger {
  id: string
  ownerUserId: string
  name: string
  description: string | null
  automationId: string
  targetDeviceId: string
  profileMode: string | null
  profileName: string | null
  enabled: boolean
  tags: AutomationTag[]
  triggerType: AutomationTriggerType
  triggerConfig: Record<string, unknown>
  lastRunAt: string | null
  lastRunId?: string | null
  nextRunAt: string | null
  lastStatus: AutomationLastStatus
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveAutomationTriggerInput {
  name: string
  description?: string | null
  automationId: string
  targetDeviceId: string
  profileMode?: string | null
  profileName?: string | null
  enabled?: boolean
  tags?: AutomationTag[]
  triggerType: AutomationTriggerType
  triggerConfig: Record<string, unknown>
}

export interface AutomationValidation {
  valid: boolean
  definition: AutomationDefinition | null
  yaml: string | null
  errors: string[]
}
