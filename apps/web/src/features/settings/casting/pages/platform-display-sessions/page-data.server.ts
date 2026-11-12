import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import {
  getDisplaySidecarHealthAction,
  listDisplaySidecarSessionsAction
} from '@/server/orchestrator/diagnostics/actions'

export const loadPlatformDisplaySessionsPageData = async () => {
  await requireAdmin()

  const [sidecarHealth, applications, users] = await Promise.all([
    getDisplaySidecarHealthAction(),
    listApplicationsAction(),
    userService.listUsers()
  ])
  const sessions = sidecarHealth.ok ? await listDisplaySidecarSessionsAction() : []

  return {
    applications,
    owners: users.map(user => ({ id: user.id, name: user.name || user.username })),
    sessions,
    sidecarHealth
  }
}
