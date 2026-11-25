import { AUTOMATION_DRAFT_TIMEOUT_MS } from '@rebroid/automation-core/yaml-draft'
import { emptyRequest, jsonRequest, request, responseRequest } from '../request'
import type {
  Automation,
  AutomationOption,
  RunnableAutomationOption,
  AutomationsGridPage,
  AutomationsGridQuery,
  AutomationTriggersGridPage,
  AutomationTriggersGridQuery,
  AutomationCommand,
  AutomationRun,
  AutomationRunHistoryRow,
  AutomationRunEvent,
  AutomationRunEventPage,
  AutomationRunEventStreamToken,
  AiPromptSuggestions,
  AutomationTrigger,
  AutomationValidation,
  DraftAutomationYamlInput,
  RunAdHocAiAutomationInput,
  RunAutomationInput,
  SaveAutomationInput,
  SaveAutomationTriggerInput,
  SuggestAdHocAiPromptsInput
} from '@/shared/contracts/automation'
import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

const ownerQuery = (ownerUserId: string, filters: AutomationsGridQuery | AutomationTriggersGridQuery = {}) => {
  const query = new URLSearchParams({ ownerUserId })
  for (const [key, value] of Object.entries(filters)) {
    const text = String(value ?? '').trim()
    if (text && key !== 'ownerUserId') query.set(key, text)
  }
  return query.toString()
}

export const orchestratorAutomationsClient = {
  listCommands() {
    return emptyRequest<AutomationCommand[]>('/automations/commands')
  },

  validateYaml(yaml: string) {
    return jsonRequest<AutomationValidation>('/automations/validate-yaml', 'POST', { yaml })
  },

  draftYamlStream(input: DraftAutomationYamlInput, signal?: AbortSignal) {
    return responseRequest('/automations/draft-yaml/stream', {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: AUTOMATION_DRAFT_TIMEOUT_MS + 15_000,
      signal
    })
  },

  listOptions(ownerUserId: string) {
    return emptyRequest<AutomationOption[]>(`/automations/options?${ownerQuery(ownerUserId)}`)
  },

  listGrid(ownerUserId: string, input: AutomationsGridQuery = {}) {
    return emptyRequest<AutomationsGridPage>(`/automations/grid?${ownerQuery(ownerUserId, input)}`)
  },

  listRunnableOptions(ownerUserId: string) {
    return emptyRequest<RunnableAutomationOption[]>(`/automations/runnable/options?${ownerQuery(ownerUserId)}`)
  },

  get(ownerUserId: string, id: string) {
    return emptyRequest<Automation>(`/automations/${encodeURIComponent(id)}?${ownerQuery(ownerUserId)}`)
  },

  create(ownerUserId: string, input: SaveAutomationInput) {
    return jsonRequest<Automation>('/automations', 'POST', { ...input, ownerUserId })
  },

  update(ownerUserId: string, id: string, input: Partial<SaveAutomationInput>) {
    return jsonRequest<Automation>(`/automations/${encodeURIComponent(id)}?${ownerQuery(ownerUserId)}`, 'PATCH', input)
  },

  remove(ownerUserId: string, id: string) {
    return request<Automation>(`/automations/${encodeURIComponent(id)}?${ownerQuery(ownerUserId)}`, {
      method: 'DELETE'
    })
  },

  run(ownerUserId: string, id: string, input: RunAutomationInput) {
    return jsonRequest<AutomationRun>(`/automations/${encodeURIComponent(id)}/runs`, 'POST', {
      ...input,
      ownerUserId
    })
  },

  listRunHistory(ownerUserId: string, id: string, limit = 50) {
    const query = new URLSearchParams({ ownerUserId, limit: String(limit) })
    return emptyRequest<AutomationRunHistoryRow[]>(`/automations/${encodeURIComponent(id)}/run-history?${query}`)
  },

  getRun(ownerUserId: string, runId: string, signal?: AbortSignal) {
    return emptyRequest<AutomationRun>(`/automations/runs/${encodeURIComponent(runId)}?${ownerQuery(ownerUserId)}`, {
      signal
    })
  },

  cancelRun(ownerUserId: string, runId: string) {
    return jsonRequest<AutomationRun>(
      `/automations/runs/${encodeURIComponent(runId)}/cancel?${ownerQuery(ownerUserId)}`,
      'POST',
      {}
    )
  },

  listRunConversationEvents(ownerUserId: string, runId: string) {
    return emptyRequest<AutomationRunEvent[]>(
      `/automations/runs/${encodeURIComponent(runId)}/events/conversation?${ownerQuery(ownerUserId)}`
    )
  },

  listRunEventPage(ownerUserId: string, runId: string, after: number, signal: AbortSignal) {
    const query = new URLSearchParams({ ownerUserId, after: String(after) })
    return emptyRequest<AutomationRunEventPage>(`/automations/runs/${encodeURIComponent(runId)}/events/page?${query}`, {
      signal
    })
  },

  createRunEventStreamToken(ownerUserId: string, runId: string, signal: AbortSignal) {
    return jsonRequest<AutomationRunEventStreamToken>(
      `/automations/runs/${encodeURIComponent(runId)}/events/token`,
      'POST',
      { ownerUserId },
      { signal }
    )
  },

  runAdHocAi(ownerUserId: string, input: RunAdHocAiAutomationInput) {
    return jsonRequest<AutomationRun>('/automations/ai/runs', 'POST', { ...input, ownerUserId })
  },

  suggestAdHocAiPrompts(ownerUserId: string, input: SuggestAdHocAiPromptsInput) {
    return jsonRequest<AiPromptSuggestions>('/automations/ai/suggestions', 'POST', { ...input, ownerUserId })
  },

  listAdHocAiRunHistory(ownerUserId: string, targetDeviceId: string, limit: number, attachmentId?: string) {
    const query = new URLSearchParams({ ownerUserId, targetDeviceId, limit: String(limit) })
    if (attachmentId) query.set('attachmentId', attachmentId)
    return emptyRequest<Array<{ run: AutomationRun; events: AutomationRunEvent[] }>>(
      `/automations/ai/run-history?${query}`
    )
  },

  clearAdHocAiRuns(ownerUserId: string, targetDeviceId: string, attachmentId?: string) {
    const query = new URLSearchParams({ ownerUserId, targetDeviceId })
    if (attachmentId) query.set('attachmentId', attachmentId)
    return request<{ cleared: number }>(`/automations/ai/runs?${query.toString()}`, {
      method: 'DELETE'
    })
  },

  listActiveRuns(ownerUserId: string) {
    return emptyRequest<OrchestratorApiSchemas['ActiveAutomationRunDto'][]>(
      `/automations/runs/active?${ownerQuery(ownerUserId)}`
    )
  },

  listTriggersGrid(ownerUserId: string, input: AutomationTriggersGridQuery = {}) {
    return emptyRequest<AutomationTriggersGridPage>(`/automations/triggers/grid?${ownerQuery(ownerUserId, input)}`)
  },

  getTrigger(ownerUserId: string, id: string) {
    return emptyRequest<AutomationTrigger>(`/automations/triggers/${encodeURIComponent(id)}?${ownerQuery(ownerUserId)}`)
  },

  createTrigger(ownerUserId: string, input: SaveAutomationTriggerInput) {
    return jsonRequest<AutomationTrigger>('/automations/triggers', 'POST', { ...input, ownerUserId })
  },

  updateTrigger(ownerUserId: string, id: string, input: Partial<SaveAutomationTriggerInput>) {
    return jsonRequest<AutomationTrigger>(
      `/automations/triggers/${encodeURIComponent(id)}?${ownerQuery(ownerUserId)}`,
      'PATCH',
      input
    )
  },

  removeTrigger(ownerUserId: string, id: string) {
    return request<AutomationTrigger>(`/automations/triggers/${encodeURIComponent(id)}?${ownerQuery(ownerUserId)}`, {
      method: 'DELETE'
    })
  },

  runTrigger(ownerUserId: string, id: string) {
    return jsonRequest<AutomationRun>(`/automations/triggers/${encodeURIComponent(id)}/runs`, 'POST', { ownerUserId })
  }
}
