import 'server-only'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'

export const revokeViewerSessionsForUsers = async (userIds: readonly string[], signal?: AbortSignal) => {
  const owners = new Set(userIds)
  if (!owners.size) return

  const sessions = await orchestratorDiagnosticsClient.listDisplaySidecarSessions(signal)
  for (const session of sessions) {
    if (!session.ownerUserId || !owners.has(session.ownerUserId)) continue
    await orchestratorDiagnosticsClient.releaseDisplaySidecarSession(session.id, signal)
  }
}

export const revokeUserViewerSessions = (userId: string) => revokeViewerSessionsForUsers([userId])
