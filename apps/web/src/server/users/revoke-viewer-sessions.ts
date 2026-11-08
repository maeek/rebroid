import 'server-only'
import { userService } from '@/server/auth/user'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'

export const revokeUserViewerSessions = async (userId: string) => {
  const sessions = await orchestratorDiagnosticsClient.listDisplaySidecarSessions()
  for (const session of sessions) {
    if (session.ownerUserId === userId) await orchestratorDiagnosticsClient.releaseDisplaySidecarSession(session.id)
  }
}

export const revokeGroupViewerSessions = async (groupId: string) => {
  const users = await userService.listUsers()
  const affectedIds = new Set(users.filter(user => user.groupIds.includes(groupId)).map(user => user.id))
  const sessions = await orchestratorDiagnosticsClient.listDisplaySidecarSessions()
  for (const session of sessions) {
    if (session.ownerUserId && affectedIds.has(session.ownerUserId)) {
      await orchestratorDiagnosticsClient.releaseDisplaySidecarSession(session.id)
    }
  }
  return [...affectedIds]
}
