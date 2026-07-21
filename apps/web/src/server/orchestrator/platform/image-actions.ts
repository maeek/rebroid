'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { requireAdminUser } from '../shared'
import { orchestratorPlatformClient } from './client'
import { runAuditedPlatformAction } from './platform-audit'
import { platformImagesGridPage } from './platform-grid-utils'
import type {
  ContainerImageRecipeInput,
  PlatformImagesGridPage,
  PlatformImagesGridQuery,
  StartContainerImageBuildInput,
  UpdateContainerImageRecipeInput,
  UpdateRuntimeImageMetadataInput
} from '@/shared/contracts/platform'

export const listPlatformImagesAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listPlatformImages()
}

export const listPlatformImagesGridAction = async (
  query: PlatformImagesGridQuery = {}
): Promise<PlatformImagesGridPage> => {
  await requireAdminUser()
  return platformImagesGridPage(await orchestratorPlatformClient.listPlatformImages(), query)
}

export const getPlatformImageAction = async (id: string) => {
  await requireAdminUser()
  return orchestratorPlatformClient.getPlatformImage(id)
}

export const removePlatformImageAction = async (id: string, force = false) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.image.remove',
        details: { force },
        operation: () => orchestratorPlatformClient.removePlatformImage(id, force),
        resourceType: 'docker_image',
        resourceId: id
      }),
    { fallbackMessage: 'Could not remove image.', logLabel: 'removePlatformImageAction failed' }
  )

export const updatePlatformImageRuntimeMetadataAction = async (id: string, input: UpdateRuntimeImageMetadataInput) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.image.runtime_metadata.update',
        details: { ...input },
        operation: () => orchestratorPlatformClient.updatePlatformImageRuntimeMetadata(id, input),
        resourceType: 'docker_image',
        resourceId: id
      }),
    { fallbackMessage: 'Could not update image metadata.', logLabel: 'updatePlatformImageRuntimeMetadataAction failed' }
  )

export const listImageBuildContextFilesAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listImageBuildContextFiles()
}

export const removeImageBuildContextFileAction = async (id: string) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.image_build.context_file.remove',
        operation: () => orchestratorPlatformClient.removeImageBuildContextFile(id),
        resourceType: 'docker_image_build_context_file',
        resourceId: id
      }),
    { fallbackMessage: 'Could not remove context file.', logLabel: 'removeImageBuildContextFileAction failed' }
  )

export const listImageBuildRecipesAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listImageBuildRecipes()
}

export const createImageBuildRecipeAction = async (input: ContainerImageRecipeInput) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.image_build.recipe.create',
        details: { targetImage: input.targetImage, baseImage: input.baseImage },
        operation: () => orchestratorPlatformClient.createImageBuildRecipe(input),
        resourceType: 'docker_image_build_recipe',
        resourceId: input.targetImage
      }),
    { fallbackMessage: 'Could not create image build recipe.', logLabel: 'createImageBuildRecipeAction failed' }
  )

export const updateImageBuildRecipeAction = async (id: string, input: UpdateContainerImageRecipeInput) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.image_build.recipe.update',
        details: { fields: Object.keys(input) },
        operation: () => orchestratorPlatformClient.updateImageBuildRecipe(id, input),
        resourceType: 'docker_image_build_recipe',
        resourceId: id
      }),
    { fallbackMessage: 'Could not update image build recipe.', logLabel: 'updateImageBuildRecipeAction failed' }
  )

export const removeImageBuildRecipeAction = async (id: string) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.image_build.recipe.remove',
        operation: () => orchestratorPlatformClient.removeImageBuildRecipe(id),
        resourceType: 'docker_image_build_recipe',
        resourceId: id
      }),
    { fallbackMessage: 'Could not remove image build recipe.', logLabel: 'removeImageBuildRecipeAction failed' }
  )

export const listImageBuildJobsAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listImageBuildJobs()
}

export const startImageBuildAction = async (input: StartContainerImageBuildInput) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.image_build.start',
        details: { targetImage: input.targetImage, baseImage: input.baseImage },
        operation: () => orchestratorPlatformClient.startImageBuild(input),
        resourceType: 'docker_image_build',
        resourceId: input.targetImage
      }),
    { fallbackMessage: 'Could not start image build.', logLabel: 'startImageBuildAction failed' }
  )

export const listGappsBuildPresetsAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listGappsBuildPresets()
}
