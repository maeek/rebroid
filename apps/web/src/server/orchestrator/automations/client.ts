import { emptyRequest, jsonRequest, request, responseRequest } from '../request'
import type {
  Automation,
  AutomationsGridPage,
  AutomationsGridQuery,
  AutomationTriggersGridPage,
  AutomationTriggersGridQuery,
  AutomationCommand,
  AutomationRun,
  AutomationRunEvent,
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
} from './types'

const ownerQuery = (ownerUserId: string) => {
  const query = new URLSearchParams({ ownerUserId })
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
      signal
    })
  },

  list(ownerUserId: string) {
    return emptyRequest<Automation[]>(`/automations?${ownerQuery(ownerUserId)}`)
  },

  listGrid(ownerUserId: string, input: AutomationsGridQuery = {}) {
    const query = new URLSearchParams({ ownerUserId })
    for (const [key, value] of Object.entries(input)) {
      const text = String(value ?? '').trim()
      if (text) query.set(key, text)
    }
    return emptyRequest<AutomationsGridPage>(`/automations/grid?${query.toString()}`)
  },

  listRunnable(ownerUserId: string) {
    return emptyRequest<Automation[]>(`/automations/runnable?${ownerQuery(ownerUserId)}`)
  },

  get(ownerUserId: string, id: string) {
    return emptyRequest<Automation>(`/automations/${encodeURIComponent(id)}?${ownerQuery(ownerUserId)}`)
  },

  create(ownerUserId: string, input: SaveAutomationInput) {
    return jsonRequest<Automation>('/automations', 'POST', { ownerUserId, ...input })
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
      ownerUserId,
      ...input
    })
  },

  listRuns(ownerUserId: string, id: string, limit = 50) {
    const query = new URLSearchParams({ ownerUserId, limit: String(limit) })
    return emptyRequest<AutomationRun[]>(`/automations/${encodeURIComponent(id)}/runs?${query.toString()}`)
  },

  getRun(ownerUserId: string, runId: string) {
    return emptyRequest<AutomationRun>(`/automations/runs/${encodeURIComponent(runId)}?${ownerQuery(ownerUserId)}`)
  },

  cancelRun(ownerUserId: string, runId: string) {
    return jsonRequest<AutomationRun>(
      `/automations/runs/${encodeURIComponent(runId)}/cancel?${ownerQuery(ownerUserId)}`,
      'POST',
      {}
    )
  },

  listRunEvents(ownerUserId: string, runId: string, after = 0) {
    const query = new URLSearchParams({ ownerUserId, after: String(after) })
    return emptyRequest<AutomationRunEvent[]>(`/automations/runs/${encodeURIComponent(runId)}/events?${query}`)
  },

  createRunEventStreamToken(ownerUserId: string, runId: string) {
    return jsonRequest<AutomationRunEventStreamToken>(
      `/automations/runs/${encodeURIComponent(runId)}/events/token`,
      'POST',
      { ownerUserId }
    )
  },

  runAdHocAi(ownerUserId: string, input: RunAdHocAiAutomationInput) {
    return jsonRequest<AutomationRun>('/automations/ai/runs', 'POST', { ownerUserId, ...input })
  },

  suggestAdHocAiPrompts(ownerUserId: string, input: SuggestAdHocAiPromptsInput) {
    return jsonRequest<AiPromptSuggestions>('/automations/ai/suggestions', 'POST', { ownerUserId, ...input })
  },

  listAdHocAiRuns(ownerUserId: string, targetApplicationId: string, limit = 20) {
    const query = new URLSearchParams({
      ownerUserId,
      targetApplicationId,
      limit: String(limit)
    })
    return emptyRequest<AutomationRun[]>(`/automations/ai/runs?${query.toString()}`)
  },

  clearAdHocAiRuns(ownerUserId: string, targetApplicationId: string) {
    const query = new URLSearchParams({ ownerUserId, targetApplicationId })
    return request<{ cleared: number }>(`/automations/ai/runs?${query.toString()}`, {
      method: 'DELETE'
    })
  },

  listActiveRuns(ownerUserId: string) {
    return emptyRequest<AutomationRun[]>(`/automations/runs/active?${ownerQuery(ownerUserId)}`)
  },

  listTriggers(ownerUserId: string) {
    return emptyRequest<AutomationTrigger[]>(`/automations/triggers?${ownerQuery(ownerUserId)}`)
  },

  listTriggersGrid(ownerUserId: string, input: AutomationTriggersGridQuery = {}) {
    const query = new URLSearchParams({ ownerUserId })
    for (const [key, value] of Object.entries(input)) {
      const text = String(value ?? '').trim()
      if (text) query.set(key, text)
    }
    return emptyRequest<AutomationTriggersGridPage>(`/automations/triggers/grid?${query.toString()}`)
  },

  createTrigger(ownerUserId: string, input: SaveAutomationTriggerInput) {
    return jsonRequest<AutomationTrigger>('/automations/triggers', 'POST', { ownerUserId, ...input })
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
