import { emptyRequest, jsonRequest, streamRequest } from '../request'
import type {
  ContainerImageBuildContextFile,
  ContainerImageBuildJob,
  ContainerImageBuildRecipe,
  ContainerImageRecipeInput,
  PlatformContainer,
  PlatformContainerDetails,
  PlatformContainerLog,
  PlatformContainerStats,
  PlatformImage,
  PlatformImageDetails,
  PlatformNetwork,
  PlatformNetworkDetails,
  StartContainerImageBuildInput,
  GappsBuildPresetsResponse,
  StartGappsBuildInput,
  UpdateContainerImageRecipeInput,
  UpdateRuntimeImageMetadataInput
} from './types'

export const orchestratorPlatformClient = {
  listPlatformContainers() {
    return emptyRequest<PlatformContainer[]>('/platform/docker/containers')
  },

  getPlatformContainer(id: string) {
    return emptyRequest<PlatformContainerDetails>(`/platform/docker/containers/${id}`)
  },

  getPlatformContainerLogs(id: string, tail = 500) {
    const query = new URLSearchParams({ tail: String(tail) })
    return emptyRequest<PlatformContainerLog>(`/platform/docker/containers/${id}/logs?${query.toString()}`)
  },

  getPlatformContainerStats(id: string) {
    return emptyRequest<PlatformContainerStats>(`/platform/docker/containers/${id}/stats`)
  },

  listPlatformImages() {
    return emptyRequest<PlatformImage[]>('/platform/docker/images')
  },

  getPlatformImage(id: string) {
    return emptyRequest<PlatformImageDetails>(`/platform/docker/images/${encodeURIComponent(id)}`)
  },

  removePlatformImage(id: string, force = false) {
    const query = new URLSearchParams({ force: String(force) })
    return emptyRequest<{ id: string; removed: boolean }>(
      `/platform/docker/images/${encodeURIComponent(id)}?${query.toString()}`,
      { method: 'DELETE' }
    )
  },

  updatePlatformImageRuntimeMetadata(id: string, input: UpdateRuntimeImageMetadataInput) {
    return jsonRequest<PlatformImageDetails>(
      `/platform/docker/images/${encodeURIComponent(id)}/runtime-metadata`,
      'PATCH',
      input
    )
  },

  listImageBuildContextFiles() {
    return emptyRequest<ContainerImageBuildContextFile[]>('/platform/container-images/build-context')
  },

  uploadImageBuildContextFile(
    input: ReadableStream<Uint8Array>,
    contextPath: string,
    contentType: string,
    signal?: AbortSignal
  ) {
    const query = new URLSearchParams({ contextPath })
    return streamRequest<ContainerImageBuildContextFile>(
      `/platform/container-images/build-context?${query.toString()}`,
      'POST',
      input,
      contentType,
      { signal }
    )
  },

  removeImageBuildContextFile(id: string) {
    return emptyRequest<{ id: string; removed: boolean }>(`/platform/container-images/build-context/${id}`, {
      method: 'DELETE'
    })
  },

  listImageBuildRecipes() {
    return emptyRequest<ContainerImageBuildRecipe[]>('/platform/container-images/recipes')
  },

  createImageBuildRecipe(input: ContainerImageRecipeInput) {
    return jsonRequest<ContainerImageBuildRecipe>('/platform/container-images/recipes', 'POST', input)
  },

  updateImageBuildRecipe(id: string, input: UpdateContainerImageRecipeInput) {
    return jsonRequest<ContainerImageBuildRecipe>(`/platform/container-images/recipes/${id}`, 'PATCH', input)
  },

  removeImageBuildRecipe(id: string) {
    return emptyRequest<{ id: string; removed: boolean }>(`/platform/container-images/recipes/${id}`, {
      method: 'DELETE'
    })
  },

  listImageBuildJobs() {
    return emptyRequest<ContainerImageBuildJob[]>('/platform/container-images/builds')
  },

  startImageBuild(input: StartContainerImageBuildInput) {
    return jsonRequest<ContainerImageBuildJob>('/platform/container-images/builds', 'POST', input)
  },

  getImageBuildJob(id: string) {
    return emptyRequest<ContainerImageBuildJob>(`/platform/container-images/builds/${id}`)
  },

  cancelImageBuild(id: string) {
    return emptyRequest<ContainerImageBuildJob>(`/platform/container-images/builds/${id}/cancel`, { method: 'POST' })
  },

  listGappsBuildPresets() {
    return emptyRequest<GappsBuildPresetsResponse>('/platform/container-images/gapps-presets')
  },

  startGappsBuild(input: StartGappsBuildInput) {
    return jsonRequest<ContainerImageBuildJob>('/platform/container-images/gapps-builds', 'POST', input)
  },

  clearGappsCache(androidVersion: string) {
    return emptyRequest<{ androidVersion: string; cleared: boolean }>(
      `/platform/container-images/gapps-cache/${encodeURIComponent(androidVersion)}`,
      { method: 'DELETE' }
    )
  },

  listPlatformNetworks() {
    return emptyRequest<PlatformNetwork[]>('/platform/docker/networks')
  },

  getPlatformNetwork(id: string) {
    return emptyRequest<PlatformNetworkDetails>(`/platform/docker/networks/${id}`)
  },

  removePlatformNetwork(id: string) {
    return emptyRequest<{ id: string; removed: boolean }>(`/platform/docker/networks/${id}`, { method: 'DELETE' })
  },

  stopPlatformContainer(id: string) {
    return emptyRequest<{ id: string; stopped: boolean }>(`/platform/docker/containers/${id}/stop`, { method: 'POST' })
  },

  removePlatformContainer(id: string, force = false) {
    const query = new URLSearchParams({ force: String(force) })
    return emptyRequest<{ id: string; removed: boolean }>(`/platform/docker/containers/${id}?${query.toString()}`, {
      method: 'DELETE'
    })
  }
}
