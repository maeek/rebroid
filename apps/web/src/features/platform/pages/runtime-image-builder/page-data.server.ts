import { requireFeature } from '@/server/orchestrator/features'
import {
  listImageBuildContextFilesAction,
  listImageBuildJobsAction,
  listImageBuildRecipesAction,
  listPlatformImagesAction
} from '@/server/orchestrator/platform/image-actions'

export const loadRuntimeImageBuilderPageData = async () => {
  await requireFeature('feature.image-builder')
  const [images, recipes, contextFiles, jobs] = await Promise.all([
    listPlatformImagesAction(),
    listImageBuildRecipesAction(),
    listImageBuildContextFilesAction(),
    listImageBuildJobsAction()
  ])

  return {
    contextFiles,
    images,
    jobs,
    recipes
  }
}
