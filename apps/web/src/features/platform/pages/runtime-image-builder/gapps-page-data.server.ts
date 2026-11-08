import { listGappsBuildPresetsAction, listImageBuildJobsAction } from '@/server/orchestrator/platform/image-actions'

export const loadRuntimeGappsBuilderPageData = async () => {
  const [presetResponse, jobs] = await Promise.all([
    listGappsBuildPresetsAction(),
    listImageBuildJobsAction().catch(() => [])
  ])

  return { presetResponse, jobs }
}
