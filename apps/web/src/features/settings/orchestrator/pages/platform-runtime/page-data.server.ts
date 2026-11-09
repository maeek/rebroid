import { unstable_rethrow } from 'next/navigation'
import { getOrchestratorBaseUrl } from '@/server/orchestrator/config'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { listPlatformImagesAction } from '@/server/orchestrator/platform/image-actions'
import { getOrchestratorSettingsAction } from '@/server/orchestrator/settings/actions'
import { getWebSettings } from '@/server/web-settings/store'
import { normalizeOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const getPlatformRuntimePageData = async () => {
  try {
    const health = await getOrchestratorHealthSummaryAction()
    if (!health.services.orchestrator.ok || !health.services.docker.ok) return null

    const [webSettings, runtimeSettings, images] = await Promise.all([
      getWebSettings(),
      getOrchestratorSettingsAction(),
      listPlatformImagesAction()
    ])
    return {
      images,
      initialSettings: normalizeOrchestratorUiSettings(webSettings, runtimeSettings, getOrchestratorBaseUrl())
    }
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
}
