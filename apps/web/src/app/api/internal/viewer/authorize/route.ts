import { z } from 'zod'
import { isCurrentAccountSession } from '@/server/auth/account-sessions'
import { getCurrentSessionIdentity, getCurrentUser } from '@/server/auth/authorization'
import { hasInternalSecret } from '@/server/auth/internal-secret'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { viewerCapabilitiesFor } from '@/server/orchestrator/applications/viewer-capabilities'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'

const targetSchema = z.object({
  appId: z.uuid(),
  runtimeId: z.string().regex(/^[a-f0-9]{64}$/),
  ownerUserId: z.string().min(1).max(200)
})

export const GET = async (request: Request) => {
  const headers = { 'Cache-Control': 'no-store' }
  if (!hasInternalSecret(request.headers)) return new Response(null, { status: 401, headers })

  const target = targetSchema.safeParse({
    appId: request.headers.get('x-rebroid-viewer-app'),
    runtimeId: request.headers.get('x-rebroid-viewer-runtime'),
    ownerUserId: request.headers.get('x-rebroid-viewer-owner')
  })
  if (!target.success) return new Response(null, { status: 403, headers })
  const authorized = await Promise.all([getCurrentUser(), getCurrentSessionIdentity()]).catch(() => null)
  if (!authorized) return new Response(null, { status: 403, headers })
  const [account, identity] = authorized
  if (account.id !== target.data.ownerUserId || hasPendingViewerRevocation(account.id)) {
    return new Response(null, { status: 403, headers })
  }

  const app = await orchestratorAppCatalogClient.getApplication(target.data.appId, request.signal).catch(() => null)
  if (
    !app ||
    app.ownerUserId !== account.id ||
    app.status.currentStatus !== 'running' ||
    app.runtime.containerId !== target.data.runtimeId ||
    hasPendingViewerRevocation(account.id) ||
    !isCurrentAccountSession(account, identity)
  ) {
    return new Response(null, { status: 403, headers })
  }
  return Response.json(
    { ownerUserId: account.id, capabilities: viewerCapabilitiesFor(account.effectivePermissions) },
    { headers }
  )
}
