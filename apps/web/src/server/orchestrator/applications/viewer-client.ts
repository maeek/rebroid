import { emptyRequest, jsonRequest } from '../request'
import { applicationPath, encodeApplicationPathSegment } from './application-path'
import type {
  ApplicationViewerControlCommand,
  ApplicationViewerControlResponse,
  ScrcpySession,
  ScrcpySessionAccess
} from '@/shared/contracts/application'

export const orchestratorAppViewerClient = {
  sendViewerControl(id: string, command: ApplicationViewerControlCommand) {
    return jsonRequest<ApplicationViewerControlResponse>(`${applicationPath(id)}/viewer/control`, 'POST', { command })
  },

  getScrcpySession(id: string, access: ScrcpySessionAccess = {}) {
    const query = new URLSearchParams()
    if (access.control) query.set('control', 'true')
    if (access.clipboard) query.set('clipboard', 'true')
    if (access.screenshot) query.set('screenshot', 'true')
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<ScrcpySession>(`${applicationPath(id)}/viewer/session${suffix}`)
  },

  recordViewerActivity(id: string, ownerUserId: string, runtimeKey: string) {
    return jsonRequest<{ id: string; lastScrcpyActivityAt: string }>(`${applicationPath(id)}/viewer/activity`, 'POST', {
      ownerUserId,
      runtimeKey
    })
  },

  createVirtualDisplay(id: string, access: ScrcpySessionAccess = {}) {
    const query = new URLSearchParams({
      control: String(access.control === true),
      clipboard: String(access.clipboard === true),
      screenshot: String(access.screenshot === true)
    })
    return emptyRequest<NonNullable<ScrcpySession['displaySession']>>(
      `${applicationPath(id)}/viewer/displays?${query}`,
      {
        method: 'POST'
      }
    )
  },

  releaseVirtualDisplay(id: string, surfaceId: string) {
    return emptyRequest<NonNullable<ScrcpySession['displaySession']>>(
      `${applicationPath(id)}/viewer/displays/${encodeApplicationPathSegment(surfaceId)}/release`,
      {
        method: 'POST'
      }
    )
  }
}
