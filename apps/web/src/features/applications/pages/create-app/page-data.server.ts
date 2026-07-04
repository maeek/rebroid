import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { listPlatformImagesAction } from '@/server/orchestrator/platform/image-actions'

export const getCreateAppPageData = async () => {
  const [initialSettings, user, images] = await Promise.all([
    getServerOrchestratorUiSettings(),
    getCurrentUserContext(),
    listPlatformImagesAction().catch(() => [])
  ])

  return {
    images,
    initialSettings,
    permissions: user.permissions
  }
}
