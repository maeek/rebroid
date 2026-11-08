import {
  listImageBuildContextFilesAction,
  listImageBuildJobsAction,
  listImageBuildRecipesAction,
  listPlatformImagesAction
} from '@/server/orchestrator/platform/image-actions'

export const loadRuntimeImageBuilderPageData = async () => {
  const [images, recipes, contextFiles, jobs] = await Promise.all([
    listPlatformImagesAction().catch(() => []),
    listImageBuildRecipesAction().catch(() => []),
    listImageBuildContextFilesAction().catch(() => []),
    listImageBuildJobsAction().catch(() => [])
  ])

  return {
    contextFiles,
    images,
    jobs,
    recipes
  }
}
