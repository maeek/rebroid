import { emptyRequest, jsonRequest, request } from '../request'
import type { Automation, AutomationCommand, AutomationRun, AutomationValidation, SaveAutomationInput } from './types'

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

  run(ownerUserId: string, id: string, targetApplicationId?: string | null) {
    return jsonRequest<AutomationRun>(`/automations/${encodeURIComponent(id)}/runs`, 'POST', {
      ownerUserId,
      targetApplicationId
    })
  },

  listRuns(ownerUserId: string, id: string, limit = 50) {
    const query = new URLSearchParams({ ownerUserId, limit: String(limit) })
    return emptyRequest<AutomationRun[]>(`/automations/${encodeURIComponent(id)}/runs?${query.toString()}`)
  },

  getRun(ownerUserId: string, runId: string) {
    return emptyRequest<AutomationRun>(`/automations/runs/${encodeURIComponent(runId)}?${ownerQuery(ownerUserId)}`)
  }
}
