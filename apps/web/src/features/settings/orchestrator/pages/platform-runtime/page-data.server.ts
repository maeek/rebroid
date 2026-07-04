import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { listPlatformImagesAction } from '@/server/orchestrator/platform/image-actions'

export const getPlatformRuntimePageData = async () => {
  const [initialSettings, images] = await Promise.all([
    getServerOrchestratorUiSettings(),
    listPlatformImagesAction().catch(() => [])
  ])

  return {
    images,
    initialSettings
  }
}
