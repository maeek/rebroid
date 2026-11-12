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
  ownedRuntimeControlMessage,
  ownedRuntimeMessage
} from './actions/common/action-helpers'
import { viewerCapabilitiesFor } from './viewer-capabilities'

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
