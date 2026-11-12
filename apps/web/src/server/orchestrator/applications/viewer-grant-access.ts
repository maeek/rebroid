import 'server-only'
import { isCurrentAccountSession } from '@/server/auth/account-sessions'
import { getCurrentSessionIdentity } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { revokeUserViewerSessions } from '@/server/users/revoke-viewer-sessions'
import { requireFeature } from '../features'
import {
  assertCanUseOwnedApplicationRuntime,
  getAccessibleApplication,
  ownedRuntimeControlMessage,
  ownedRuntimeMessage
} from './actions/common/action-helpers'
import { sanitizeAndroidApplicationForUser, sanitizeScrcpySessionForUser } from './safety'
import { viewerCapabilitiesFor } from './viewer-capabilities'
import { orchestratorAppViewerClient } from './viewer-client'
import type { CurrentUserContext } from './actions/common/action-helpers'

const assertViewerRevocationComplete = (userId: string) => {
  if (hasPendingViewerRevocation(userId)) {
    throw new PublicActionError('Viewer access is being updated. Try again shortly.', {
      code: 'upstream_unavailable',
      status: 503
    })
  }
}

const staleViewerGrant = () =>
  new PublicActionError('Viewer authorization changed. Refresh and try again.', {
    code: 'forbidden',
    status: 403
  })

export const issueViewerGrant = async <Grant>(
  id: string,
  surface: 'main' | 'virtual',
  mint: (capabilities: ReturnType<typeof viewerCapabilitiesFor>) => Promise<Grant>
) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(
    id,
    surface === 'main' ? ownedRuntimeMessage : ownedRuntimeControlMessage
  )
  return mintViewerGrant(user, surface, mint)
}

export const loadViewerPageApplication = async (id: string) => {
  const { app, user } = await getAccessibleApplication(id)
  return {
    app: sanitizeAndroidApplicationForUser(app, user),
    openSession: async () => {
      if (app.ownerUserId !== user.ownerUserId) {
        throw new PublicActionError(ownedRuntimeMessage, { code: 'forbidden', status: 403 })
      }
      const current = await mintViewerGrant(user, 'main', access =>
        orchestratorAppViewerClient.getScrcpySession(id, access)
      )
      return sanitizeScrcpySessionForUser(current.grant, current.user)
    }
  }
}

const mintViewerGrant = async <Grant>(
  user: CurrentUserContext,
  surface: 'main' | 'virtual',
  mint: (capabilities: ReturnType<typeof viewerCapabilitiesFor>) => Promise<Grant>
) => {
  const identity = await getCurrentSessionIdentity()
  if (identity.userId !== user.ownerUserId) throw staleViewerGrant()

  const capabilities = viewerCapabilitiesFor(user.permissions)
  if (surface === 'virtual') {
    await requireFeature('feature.display-virtual')
    if (!capabilities.control) {
      throw new PublicActionError('You do not have permission to add displays for this viewer.', {
        code: 'forbidden',
        status: 403
      })
    }
  }

  assertViewerRevocationComplete(user.ownerUserId)
  const grant = await mint(capabilities)
  const account = await userService.getUserById(user.ownerUserId)
  if (
    !account ||
    account.disabled ||
    account.passwordChangeRequired ||
    account.isPlatformAdmin !== user.isPlatformAdmin
  ) {
    await revokeUserViewerSessions(user.ownerUserId)
    throw staleViewerGrant()
  }

  const current = viewerCapabilitiesFor(account.effectivePermissions)
  if (
    (capabilities.control && !current.control) ||
    (capabilities.clipboard && !current.clipboard) ||
    (capabilities.screenshot && !current.screenshot)
  ) {
    await revokeUserViewerSessions(user.ownerUserId)
    throw staleViewerGrant()
  }

  // The sidecar may return a reused grant. Withhold it if this request's session was invalidated.
  if (!isCurrentAccountSession(account, identity)) throw staleViewerGrant()
  assertViewerRevocationComplete(user.ownerUserId)
  return {
    grant,
    user: { ...user, permissions: account.effectivePermissions, quotas: account.effectiveQuotas }
  }
}
