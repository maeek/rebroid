import { emptyRequest, jsonRequest } from '../request'
import type {
  ApplicationViewerControlCommand,
  ApplicationViewerControlResponse,
  ScrcpySession,
  ScrcpySessionAccess
} from '@/shared/contracts/application'

export const orchestratorAppViewerClient = {
  sendViewerControl(id: string, command: ApplicationViewerControlCommand) {
    return jsonRequest<ApplicationViewerControlResponse>(`/apps/${id}/viewer/control`, 'POST', { command })
  },

  getScrcpySession(id: string, access: ScrcpySessionAccess = {}) {
    const query = new URLSearchParams()
    if (access.control) query.set('control', 'true')
    if (access.clipboard) query.set('clipboard', 'true')
    if (access.screenshot) query.set('screenshot', 'true')
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<ScrcpySession>(`/apps/${id}/viewer/session${suffix}`)
  },

  recordViewerActivity(id: string) {
    return emptyRequest<{ id: string; lastScrcpyActivityAt: string }>(`/apps/${id}/viewer/activity`, {
      method: 'POST'
    })
  },

  createVirtualDisplay(id: string) {
    return emptyRequest<NonNullable<ScrcpySession['displaySession']>>(`/apps/${id}/viewer/displays`, {
      method: 'POST'
    })
  },

  releaseVirtualDisplay(id: string, surfaceId: string) {
    return emptyRequest<NonNullable<ScrcpySession['displaySession']>>(
      `/apps/${id}/viewer/displays/${encodeURIComponent(surfaceId)}/release`,
      {
        method: 'POST'
      }
    )
  }
}
