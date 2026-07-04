import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-client'

export type PlatformContainer = OrchestratorApiSchemas['DockerPlatformContainerDto']
export type PlatformContainerDetails = OrchestratorApiSchemas['DockerPlatformContainerDetailsDto']
export type PlatformContainerLog = OrchestratorApiSchemas['DockerPlatformContainerLogDto']
export type PlatformContainerStats = OrchestratorApiSchemas['DockerPlatformContainerStatsDto']
export type PlatformImage = OrchestratorApiSchemas['DockerPlatformImageDto']
export type PlatformImageDetails = Omit<OrchestratorApiSchemas['DockerPlatformImageDetailsDto'], 'image'> & {
  image: PlatformImage
}
export type PlatformNetwork = OrchestratorApiSchemas['DockerPlatformNetworkDto']
export type PlatformNetworkDetails = OrchestratorApiSchemas['DockerPlatformNetworkDetailsDto']

export type PlatformResourceScope = 'managed' | 'all'

export interface PlatformImagesGridQuery {
  page?: number
  pageSize?: number
  q?: string
  scope?: PlatformResourceScope
  sort?: string
}

export interface PlatformImagesGridPage {
  items: PlatformImage[]
  total: number
  page: number
  pageSize: number
}

export interface PlatformContainersGridQuery {
  page?: number
  pageSize?: number
  q?: string
  scope?: PlatformResourceScope
  sort?: string
}

export interface PlatformContainersGridPage {
  items: PlatformContainer[]
  total: number
  page: number
  pageSize: number
  orphanedCount: number
}

export interface PlatformNetworksGridQuery {
  page?: number
  pageSize?: number
  q?: string
  scope?: PlatformResourceScope
  sort?: string
}

export interface PlatformNetworksGridPage {
  items: PlatformNetwork[]
  total: number
  page: number
  pageSize: number
}

export type ContainerImageBuildStatus = OrchestratorApiSchemas['ContainerImageBuildJob']['status']
export type ContainerImageBuildContextFile = OrchestratorApiSchemas['ContainerImageBuildContextFile']
export type ContainerImageBuildRecipe = OrchestratorApiSchemas['ContainerImageBuildRecipe']
export type ContainerImageBuildJob = OrchestratorApiSchemas['ContainerImageBuildJob']
export type ContainerImageRecipeInput = OrchestratorApiSchemas['CreateContainerImageRecipeDto']
export type UpdateContainerImageRecipeInput = OrchestratorApiSchemas['UpdateContainerImageRecipeDto']
export type StartContainerImageBuildInput = OrchestratorApiSchemas['StartContainerImageBuildDto']
export type UpdateRuntimeImageMetadataInput = OrchestratorApiSchemas['UpdateRuntimeImageMetadataDto']
