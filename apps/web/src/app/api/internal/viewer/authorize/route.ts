import { z } from 'zod'
import { isCurrentAccountSession } from '@/server/auth/account-sessions'
import { getCurrentSessionIdentity, getCurrentUser } from '@/server/auth/authorization'
import { hasExternalViewerSecret, hasInternalSecret } from '@/server/auth/internal-secret'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { viewerCapabilitiesFor } from '@/server/orchestrator/applications/viewer-capabilities'
import { externalDeviceClient } from '@/server/orchestrator/external-devices/client'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { hasPermission } from '@/shared/permissions/permissions'

const targetSchema = z.object({
  appId: z.uuid(),
  runtimeId: z.union([z.string().regex(/^[a-f0-9]{64}$/), z.uuid()]),
  ownerUserId: z.string().min(1).max(200)
})

export const GET = async (request: Request) => {
  const headers = { 'Cache-Control': 'no-store' }
  const kind = request.headers.get('x-rebroid-viewer-kind')
  const external = kind === 'external'
  const viewerKind = external ? 'external' : 'managed'
  if (!(external ? hasExternalViewerSecret : hasInternalSecret)(request.headers) || (kind !== null && !external)) {
    return new Response(null, { status: 401, headers })
  }

  const target = targetSchema.safeParse({
    appId: request.headers.get('x-rebroid-viewer-app'),
    runtimeId: request.headers.get('x-rebroid-viewer-runtime'),
    ownerUserId: request.headers.get('x-rebroid-viewer-owner')
  })
  if (!target.success || z.uuid().safeParse(target.data.runtimeId).success !== external) {
    return new Response(null, { status: 403, headers })
  }
  const authorized = await Promise.all([getCurrentUser(), getCurrentSessionIdentity()]).catch(() => null)
  if (!authorized) return new Response(null, { status: 403, headers })
  const [account, identity] = authorized
  if (account.id !== target.data.ownerUserId || hasPendingViewerRevocation(account.id, viewerKind)) {
    return new Response(null, { status: 403, headers })
  }

  if (external && !account.isPlatformAdmin && !hasPermission(account.effectivePermissions, 'devices:use-external')) {
    return new Response(null, { status: 403, headers })
  }
  const device = await (
    external
      ? externalDeviceClient
          .attachment(
            target.data.appId,
            target.data.runtimeId,
            {
              userId: account.id,
              administrator: account.isPlatformAdmin
            },
            request.signal
          )
          .then(value => ({ ...value, runtimeId: value.attachmentId }))
      : orchestratorAppCatalogClient.getViewerRuntime(target.data.appId, request.signal)
  ).catch(() => null)
  if (
    !device ||
    device.deviceId !== target.data.appId ||
    device.ownerUserId !== account.id ||
    device.runtimeId !== target.data.runtimeId ||
    hasPendingViewerRevocation(account.id, viewerKind) ||
    !isCurrentAccountSession(account, identity)
  ) {
    return new Response(null, { status: 403, headers })
  }
  return Response.json(
    {
      ownerUserId: account.id,
      accountSessionId: identity.sessionId,
      capabilities: viewerCapabilitiesFor(account.effectivePermissions)
    },
    { headers }
  )
}
