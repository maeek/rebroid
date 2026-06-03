import { emptyRequest, jsonRequest } from '../request'
import type {
  ApplicationViewerControlCommand,
  ApplicationViewerControlResponse,
  ScrcpySession,
  ScrcpySessionAccess
} from './types'

export const orchestratorAppViewerClient = {
  sendViewerControl(id: string, command: ApplicationViewerControlCommand) {
    return jsonRequest<ApplicationViewerControlResponse>(`/apps/${id}/viewer/control`, 'POST', { command })
  },

  getScrcpySession(id: string, access: ScrcpySessionAccess = {}) {
    const query = new URLSearchParams()
    if (access.control) query.set('control', 'true')
    if (access.clipboard) query.set('clipboard', 'true')
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return emptyRequest<ScrcpySession>(`/apps/${id}/viewer/session${suffix}`)
  },

  recordViewerActivity(id: string) {
    return emptyRequest<{ id: string; lastScrcpyActivityAt: string }>(`/apps/${id}/viewer/activity`, {
      method: 'POST'
    })
  }
}
