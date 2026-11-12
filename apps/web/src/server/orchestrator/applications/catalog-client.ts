import { PublicActionError } from '@/server/errors/public-action-error'
import { emptyRequest, jsonRequest, OrchestratorRequestError } from '../request'
import { applicationImageAccessHeaders, type ApplicationImageActor } from './image-access'
import { openAppQuotaHeaders, throwOpenAppQuotaError } from './open-app-quota'
import type {
  AndroidApplication,
  AndroidApplicationSummary,
  ApplicationCommandResult,
  CloneApplicationInput,
  CreateAndroidApplicationInput,
  DeleteAndroidApplicationResponse,
  AndroidAppRuntimeReconciliation,
  UpdateAndroidApplicationInput
} from '@/shared/contracts/application'
import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

const throwAppCreateError = (error: unknown): never => {
  if (error instanceof OrchestratorRequestError && error.details?.code === 'application_image_forbidden') {
    throw new PublicActionError('You do not have permission to use this runtime image.', {
      code: 'forbidden',
      status: 403
    })
  }
  return throwOpenAppQuotaError(error)
}

export const orchestratorAppCatalogClient = {
  createApplication(
    input: CreateAndroidApplicationInput,
    requestId: string,
    maxOpenApps: number | null,
    actor: ApplicationImageActor
  ) {
    return jsonRequest<ApplicationCommandResult>('/apps', 'POST', input, {
      headers: {
        ...openAppQuotaHeaders(maxOpenApps),
        ...applicationImageAccessHeaders(actor),
        'x-request-id': requestId
      }
    }).catch(throwAppCreateError)
  },

  listApplications(ownerUserId?: string) {
    const query = new URLSearchParams()
    if (ownerUserId) query.set('ownerUserId', ownerUserId)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<AndroidApplication[]>(`/apps${suffix}`)
  },

  reconcileApplication(id: string) {
    return jsonRequest<AndroidAppRuntimeReconciliation>(
      `/apps/${encodeURIComponent(id)}/runtime-state/reconcile`,
      'POST',
      {}
    )
  },

  listApplicationSummaries(
    ownerUserId?: string,
    filters?: { applicationIds?: readonly string[]; includeRunning?: boolean }
  ) {
    const query = new URLSearchParams()
    if (ownerUserId) query.set('ownerUserId', ownerUserId)
    for (const id of filters?.applicationIds ?? []) query.append('applicationIds', id)
    if (filters?.includeRunning) query.set('includeRunning', 'true')
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<AndroidApplicationSummary[]>(`/apps/summaries${suffix}`)
  },

  getApplication(id: string, signal?: AbortSignal) {
    return emptyRequest<AndroidApplication>(`/apps/${id}`, { signal })
  },

  getViewerRuntime(id: string, signal?: AbortSignal) {
    return emptyRequest<OrchestratorApiSchemas['AndroidApplicationViewerRuntimeDto']>(
      `/apps/${encodeURIComponent(id)}/viewer-runtime`,
      { signal }
    )
  },

  cloneApplication(id: string, input: CloneApplicationInput, maxOpenApps: number | null, actor: ApplicationImageActor) {
    return jsonRequest<ApplicationCommandResult>(`/apps/${id}/clone`, 'POST', input, {
      headers: { ...openAppQuotaHeaders(maxOpenApps), ...applicationImageAccessHeaders(actor) }
    }).catch(throwAppCreateError)
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
