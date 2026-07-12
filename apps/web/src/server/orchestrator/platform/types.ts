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
export type PlatformResourceOwnership = 'managed' | 'all'
export type PlatformUsageFilter = 'all' | 'in-use' | 'unused' | 'unknown'
export type PlatformAttachmentFilter = 'all' | 'attached' | 'unattached'

export interface PlatformImagesGridQuery {
  page?: number
  pageSize?: number
  q?: string
  ownership?: PlatformResourceOwnership
  usage?: PlatformUsageFilter
  runtimeKind?: 'all' | 'redroid' | 'generic'
  androidVersion?: string
  architecture?: string
  gmsMode?: 'all' | 'none' | 'microg' | 'gapps'
  sort?: string
}

export interface PlatformImagesGridPage {
  items: PlatformImage[]
  total: number
  page: number
  pageSize: number
  facets: {
    androidVersions: string[]
    architectures: string[]
  }
}

export interface PlatformContainersGridQuery {
  page?: number
  pageSize?: number
  q?: string
  ownership?: PlatformResourceOwnership
  state?: string
  application?: string
  image?: string
  network?: string
  sort?: string
}

export interface PlatformContainersGridPage {
  items: PlatformContainer[]
  total: number
  page: number
  pageSize: number
  orphanedCount: number
  facets: {
    states: string[]
    applications: string[]
    images: string[]
    networks: string[]
  }
}

export interface PlatformNetworksGridQuery {
  page?: number
  pageSize?: number
  q?: string
  ownership?: PlatformResourceOwnership
  driver?: string
  dockerScope?: string
  trait?: 'all' | 'internal' | 'attachable' | 'ingress'
  attachment?: PlatformAttachmentFilter
  sort?: string
}

export interface PlatformNetworksGridPage {
  items: PlatformNetwork[]
  total: number
  page: number
  pageSize: number
  facets: {
    drivers: string[]
    scopes: string[]
  }
}

export type ContainerImageBuildStatus = OrchestratorApiSchemas['ContainerImageBuildJob']['status']
export type ContainerImageBuildContextFile = OrchestratorApiSchemas['ContainerImageBuildContextFile']
export type ContainerImageBuildRecipe = OrchestratorApiSchemas['ContainerImageBuildRecipe']
export type ContainerImageBuildJob = OrchestratorApiSchemas['ContainerImageBuildJob']
export type ContainerImageRecipeInput = OrchestratorApiSchemas['CreateContainerImageRecipeDto']
export type UpdateContainerImageRecipeInput = OrchestratorApiSchemas['UpdateContainerImageRecipeDto']
export type StartContainerImageBuildInput = OrchestratorApiSchemas['StartContainerImageBuildDto']
export type UpdateRuntimeImageMetadataInput = OrchestratorApiSchemas['UpdateRuntimeImageMetadataDto']

export type GappsBuildPhase = ContainerImageBuildJob['phase']
export type GappsBuildPreset = OrchestratorApiSchemas['GappsBuildPresetDto']
export type GappsBuildResourceStatus = OrchestratorApiSchemas['GappsBuildResourceStatusDto']
export type GappsBuildPresetsResponse = OrchestratorApiSchemas['GappsBuildPresetsResponseDto']
export type StartGappsBuildInput = OrchestratorApiSchemas['StartGappsBuildDto']
export type SupportedGappsAndroidVersion = StartGappsBuildInput['androidVersion']
