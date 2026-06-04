import { emptyRequest, jsonRequest, request } from '../request'
import type {
  Automation,
  AutomationCommand,
  AutomationRun,
  AutomationTrigger,
  AutomationValidation,
  RunAutomationInput,
  SaveAutomationInput,
  SaveAutomationTriggerInput
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

  list(ownerUserId: string) {
    return emptyRequest<Automation[]>(`/automations?${ownerQuery(ownerUserId)}`)
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

  listActiveRuns(ownerUserId: string) {
    return emptyRequest<AutomationRun[]>(`/automations/runs?${ownerQuery(ownerUserId)}&status=active`)
  },

  listTriggers(ownerUserId: string) {
    return emptyRequest<AutomationTrigger[]>(`/automations/triggers?${ownerQuery(ownerUserId)}`)
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
