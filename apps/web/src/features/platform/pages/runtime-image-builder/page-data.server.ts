import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import {
  listImageBuildContextFilesAction,
  listImageBuildJobsAction,
  listImageBuildRecipesAction,
  listPlatformImagesAction
} from '@/server/orchestrator/platform/image-actions'

export const loadRuntimeImageBuilderPageData = async () => {
  const [images, recipes, contextFiles, jobs, initialSettings] = await Promise.all([
    listPlatformImagesAction().catch(() => []),
    listImageBuildRecipesAction().catch(() => []),
    listImageBuildContextFilesAction().catch(() => []),
    listImageBuildJobsAction().catch(() => []),
    getServerOrchestratorUiSettings()
  ])

  return {
    contextFiles,
    images,
    initialSettings,
    jobs,
    recipes
  }
}
