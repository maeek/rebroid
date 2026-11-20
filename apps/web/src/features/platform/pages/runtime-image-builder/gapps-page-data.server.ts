import { requireFeature } from '@/server/orchestrator/features'
import { listGappsBuildPresetsAction, getLatestImageBuildAction } from '@/server/orchestrator/platform/image-actions'

export const loadRuntimeGappsBuilderPageData = async () => {
  await requireFeature('feature.image-builder')
  const [presetResponse, initialJob] = await Promise.all([
    listGappsBuildPresetsAction(),
    getLatestImageBuildAction('redroid_gapps_patch')
  ])

  return { presetResponse, initialJob }
}
