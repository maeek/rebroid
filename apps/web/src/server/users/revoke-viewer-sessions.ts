import 'server-only'
import { jsonRequest } from '@/server/orchestrator/request'
import type { ViewerRevocationKind } from '@/server/persistence/web-maintenance-repository'
import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

const maxOwnersPerRequest = 256

const revokePaths = {
  managed: '/platform/display-sidecar/sessions/revoke',
  external: '/devices/external/viewer-sessions/revoke'
} satisfies Record<ViewerRevocationKind, string>

export const revokeViewerSessionsForUsers = async (
  userIds: readonly string[],
  signal?: AbortSignal,
  kind: ViewerRevocationKind = 'managed'
) => {
  const owners = [...new Set(userIds)]
  for (let start = 0; start < owners.length; start += maxOwnersPerRequest) {
    signal?.throwIfAborted()
    const input: OrchestratorApiSchemas['RevokeDockerSidecarSessionsDto'] = {
      ownerUserIds: owners.slice(start, start + maxOwnersPerRequest)
    }
    await jsonRequest<OrchestratorApiSchemas['DockerSidecarSessionRevocationDto']>(revokePaths[kind], 'POST', input, {
      signal
    })
  }
}

export const revokeUserViewerSessions = (userId: string) => revokeViewerSessionsForUsers([userId])
