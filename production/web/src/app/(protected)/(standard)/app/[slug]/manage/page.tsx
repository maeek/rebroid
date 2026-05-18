import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcon } from '@/features/applications/icons/enrich'
import AppManage from '@/features/applications/manage/app-manage'
import { getApplicationAction } from '@/server/orchestrator/applications/read-actions'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUserContext()
  const initialSettings = await getServerOrchestratorUiSettings()
  const app = await getApplicationAction(slug)
    .then(mapAndroidApplicationToAppDefinition)
    .then(withStoredAppIcon)
    .catch(() => undefined)

  return (
    <AppManage
      app={app}
      initialSettings={initialSettings}
      permissions={user.permissions}
    />
  )
}
