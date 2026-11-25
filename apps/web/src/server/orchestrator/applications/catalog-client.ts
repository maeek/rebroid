import { managedAndroidDeviceKind } from '@rebroid/android-application-core/android-device'
import { PublicActionError } from '@/server/errors/public-action-error'
import { emptyRequest, jsonRequest, OrchestratorRequestError } from '../request'
import { applicationPath } from './application-path'
import { applicationImageAccessHeaders, type ApplicationImageActor } from './image-access'
import { openAppQuotaHeaders, throwOpenAppQuotaError } from './open-app-quota'
import type {
  AndroidApplication,
  AndroidApplicationSummary,
  ApplicationCommandResult,
  CloneApplicationInput,
  CreateAndroidApplicationInput,
  DeleteAndroidApplicationResponse,
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
    return jsonRequest<ApplicationCommandResult>(
      '/devices',
      'POST',
      { ...input, kind: managedAndroidDeviceKind },
      {
        headers: {
          ...openAppQuotaHeaders(maxOpenApps),
          ...applicationImageAccessHeaders(actor),
          'x-request-id': requestId
        }
      }
    ).catch(throwAppCreateError)
  },

  listApplications(ownerUserId?: string) {
    const query = new URLSearchParams()
    if (ownerUserId) query.set('ownerUserId', ownerUserId)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<AndroidApplication[]>(`/devices${suffix}`)
  },

  listApplicationGallery(ownerUserId?: string) {
    const suffix = ownerUserId ? `?${new URLSearchParams({ ownerUserId })}` : ''
    return emptyRequest<OrchestratorApiSchemas['AndroidApplicationGalleryRowDto'][]>(`/devices/gallery${suffix}`)
  },

  async listApplicationNavigation(query: OrchestratorApiSchemas['ListAndroidApplicationNavigationDto']) {
    const rows = await jsonRequest<OrchestratorApiSchemas['AndroidApplicationNavigationRowDto'][]>(
      '/devices/navigation',
      'POST',
      query
    )
    return rows.map(({ status, ...row }) => ({ ...row, currentStatus: status }))
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
    return emptyRequest<AndroidApplicationSummary[]>(`/devices/summaries${suffix}`)
  },

  getApplication(id: string, signal?: AbortSignal) {
    return emptyRequest<AndroidApplication>(applicationPath(id), { signal })
  },

  refreshApplicationDetail(id: string, revision?: string, signal?: AbortSignal) {
    const query = revision ? `?${new URLSearchParams({ revision })}` : ''
    return emptyRequest<OrchestratorApiSchemas['AndroidApplicationDetailRefreshDto']>(
      `${applicationPath(id)}/detail${query}`,
      { signal }
    )
  },

  getViewerRuntime(id: string, signal?: AbortSignal) {
    return emptyRequest<OrchestratorApiSchemas['AndroidDeviceViewerTargetDto']>(
      `${applicationPath(id)}/viewer-runtime`,
      { signal }
    )
  },

  cloneApplication(id: string, input: CloneApplicationInput, maxOpenApps: number | null, actor: ApplicationImageActor) {
    return jsonRequest<ApplicationCommandResult>(`${applicationPath(id)}/clone`, 'POST', input, {
      headers: { ...openAppQuotaHeaders(maxOpenApps), ...applicationImageAccessHeaders(actor) }
    }).catch(throwAppCreateError)
  },

  updateApplication(id: string, input: UpdateAndroidApplicationInput) {
    return jsonRequest<ApplicationCommandResult>(applicationPath(id), 'PATCH', input)
  },

  deleteApplication(id: string, removeData = true) {
    const query = new URLSearchParams({ removeData: String(removeData) })
    return emptyRequest<DeleteAndroidApplicationResponse>(`${applicationPath(id)}?${query.toString()}`, {
      method: 'DELETE'
    })
  }
}
