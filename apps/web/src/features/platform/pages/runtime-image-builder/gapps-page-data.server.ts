import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { listGappsBuildPresetsAction, listImageBuildJobsAction } from '@/server/orchestrator/platform/image-actions'

export const loadRuntimeGappsBuilderPageData = async () => {
  const [presetResponse, jobs, initialSettings] = await Promise.all([
    listGappsBuildPresetsAction(),
    listImageBuildJobsAction().catch(() => []),
    getServerOrchestratorUiSettings()
  ])

  return { presetResponse, jobs, initialSettings }
}
