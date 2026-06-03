import { emptyRequest, jsonRequest } from '../request'
import type {
  AndroidApplication,
  AndroidApplicationSummary,
  ApplicationCommandResult,
  CloneApplicationInput,
  CreateAndroidApplicationInput,
  DeleteAndroidApplicationResponse,
  UpdateAndroidApplicationInput
} from './types'

export const orchestratorAppCatalogClient = {
  createApplication(input: CreateAndroidApplicationInput) {
    return jsonRequest<ApplicationCommandResult>('/apps', 'POST', input)
  },

  listApplications(ownerUserId?: string, reconcile = true) {
    const query = new URLSearchParams()
    if (ownerUserId) query.set('ownerUserId', ownerUserId)
    if (!reconcile) query.set('reconcile', 'false')
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<AndroidApplication[]>(`/apps${suffix}`)
  },

  listApplicationSummaries(ownerUserId?: string) {
    const query = ownerUserId ? `?${new URLSearchParams({ ownerUserId }).toString()}` : ''
    return emptyRequest<AndroidApplicationSummary[]>(`/apps/summaries${query}`)
  },

  getApplication(id: string) {
    return emptyRequest<AndroidApplication>(`/apps/${id}`)
  },

  cloneApplication(id: string, input: CloneApplicationInput) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}/clone`, 'POST', input)
  },

  updateApplication(id: string, input: UpdateAndroidApplicationInput) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}`, 'PATCH', input)
  },

  deleteApplication(id: string, removeData = true) {
    const query = new URLSearchParams({ removeData: String(removeData) })
    return emptyRequest<DeleteAndroidApplicationResponse>(`/apps/${id}?${query.toString()}`, {
      method: 'DELETE'
    })
  }
}
