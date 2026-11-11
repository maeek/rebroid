import 'server-only'
import { jsonRequest } from '@/server/orchestrator/request'
import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

const maxOwnersPerRequest = 256

export const revokeViewerSessionsForUsers = async (userIds: readonly string[], signal?: AbortSignal) => {
  const owners = [...new Set(userIds)]
  for (let start = 0; start < owners.length; start += maxOwnersPerRequest) {
    signal?.throwIfAborted()
    const input: OrchestratorApiSchemas['RevokeDockerSidecarSessionsDto'] = {
      ownerUserIds: owners.slice(start, start + maxOwnersPerRequest)
    }
    await jsonRequest<OrchestratorApiSchemas['DockerSidecarSessionRevocationDto']>(
      '/platform/display-sidecar/sessions/revoke',
      'POST',
      input,
      { signal }
    )
  }
}

export const revokeUserViewerSessions = (userId: string) => revokeViewerSessionsForUsers([userId])
