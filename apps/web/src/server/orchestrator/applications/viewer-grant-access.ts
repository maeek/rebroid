import 'server-only'
import { userService } from '@/server/auth/user'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { revokeUserViewerSessions } from '@/server/users/revoke-viewer-sessions'
import { hasPermission } from '@/shared/permissions/permissions'
import type { CurrentUserContext } from './actions/common/action-helpers'

export const assertViewerRevocationComplete = (userId: string) => {
  if (hasPendingViewerRevocation(userId)) {
    throw new PublicActionError('Viewer access is being updated. Try again shortly.', {
      code: 'upstream_unavailable',
      status: 503
    })
  }
}

export const assertViewerGrantCurrent = async (user: CurrentUserContext) => {
  const account = await userService.getUserById(user.ownerUserId)
  const viewerPermissions = [
    'applications:control-viewer',
    'applications:sync-clipboard',
    'applications:capture-screenshot'
  ] as const
  const stale =
    !account ||
    account.disabled ||
    account.passwordChangeRequired ||
    account.role !== user.role ||
    viewerPermissions.some(
      permission =>
        hasPermission(user.permissions, permission) && !hasPermission(account.effectivePermissions, permission)
    )
  if (stale) {
    await revokeUserViewerSessions(user.ownerUserId)
    throw new PublicActionError('Viewer authorization changed. Refresh and try again.', {
      code: 'forbidden',
      status: 403
    })
  }
  assertViewerRevocationComplete(user.ownerUserId)
}
