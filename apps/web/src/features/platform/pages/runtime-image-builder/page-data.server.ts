import { requireFeature } from '@/server/orchestrator/features'
import {
  listImageBuildContextFilesAction,
  getLatestImageBuildAction,
  listImageBuildRecipesAction,
  listPlatformImagesAction
} from '@/server/orchestrator/platform/image-actions'

export const loadRuntimeImageBuilderPageData = async () => {
  await requireFeature('feature.image-builder')
  const [images, recipes, contextFiles, initialJob] = await Promise.all([
    listPlatformImagesAction(),
    listImageBuildRecipesAction(),
    listImageBuildContextFilesAction(),
    getLatestImageBuildAction('dockerfile_overlay')
  ])

  return {
    contextFiles,
    images,
    initialJob,
    recipes
  }
}
