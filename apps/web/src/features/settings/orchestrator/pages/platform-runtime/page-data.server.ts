import { unstable_rethrow } from 'next/navigation'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { listPlatformImagesAction } from '@/server/orchestrator/platform/image-actions'
import { getOrchestratorSettingsAction } from '@/server/orchestrator/settings/actions'
import { getWebSettings } from '@/server/web-settings/store'
import { normalizeOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const loadAppliedRenderingSettings = async () => {
  try {
    const applications = await listApplicationsAction()
    return applications.flatMap(({ runtime }) =>
      runtime.kind === 'redroid' && runtime.containerId ? [runtime.appliedRendering ?? null] : []
    )
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
}

export const getPlatformRuntimePageData = async () => {
  try {
    const health = await getOrchestratorHealthSummaryAction()
    if (!health.services.orchestrator.ok || !health.services.docker.ok) return null

    const [webSettings, runtimeSettings, images, appliedRenderingSettings] = await Promise.all([
      getWebSettings(),
      getOrchestratorSettingsAction(),
      listPlatformImagesAction(),
      loadAppliedRenderingSettings()
    ])
    return {
      images,
      appliedRenderingSettings,
      initialSettings: normalizeOrchestratorUiSettings(webSettings, runtimeSettings)
    }
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
}
