import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcon } from '@/features/applications/icons/enrich'
import AppManage from '@/features/applications/manage/app-manage'
import { userService } from '@/server/auth/user'
import { getApplicationAction } from '@/server/orchestrator/applications/read-actions'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getResourceLimitBoundsAction } from '@/server/orchestrator/diagnostics/actions'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUserContext()
  const initialSettings = await getServerOrchestratorUiSettings()
  const resourceLimits = await getResourceLimitBoundsAction().catch(() => null)
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
    <AppManage
      app={app}
      initialSettings={initialSettings}
      resourceLimits={resourceLimits}
      permissions={user.permissions}
      currentOwnerUserId={user.ownerUserId}
      isAdmin={user.role === 'admin'}
    />
  )
}
