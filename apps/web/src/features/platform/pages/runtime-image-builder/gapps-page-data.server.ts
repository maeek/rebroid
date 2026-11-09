import { requireFeature } from '@/server/orchestrator/features'
import { listGappsBuildPresetsAction, listImageBuildJobsAction } from '@/server/orchestrator/platform/image-actions'

export const loadRuntimeGappsBuilderPageData = async () => {
  await requireFeature('feature.image-builder')
  const [presetResponse, jobs] = await Promise.all([listGappsBuildPresetsAction(), listImageBuildJobsAction()])

  return { presetResponse, jobs }
}
