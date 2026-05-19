import { AppViewerPage } from '@/features/applications/detail/app-page'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcon } from '@/features/applications/icons/enrich'
import { userService } from '@/server/auth/user'
import { getApplicationAction } from '@/server/orchestrator/applications/read-actions'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUserContext()
  const initialSettings = await getServerOrchestratorUiSettings()
  const ownerNames =
    user.role === 'admin'
      ? new Map((await userService.listUsers()).map(owner => [owner.id, owner.name || owner.username]))
      : new Map<string, string>()
  const app = await getApplicationAction(slug)
    .then(mapAndroidApplicationToAppDefinition)
    .then(item => ({
      ...item,
      ownerDisplayName: item.ownerUserId ? (ownerNames.get(item.ownerUserId) ?? item.ownerUserId) : null
    }))
    .then(withStoredAppIcon)
    .catch(() => undefined)

  return (
    <AppViewerPage
      app={app}
      initialSettings={initialSettings}
      permissions={user.permissions}
      currentOwnerUserId={user.ownerUserId}
      isAdmin={user.role === 'admin'}
    />
  )
}
