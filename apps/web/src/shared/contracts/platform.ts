import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type PlatformContainer = OrchestratorApiSchemas['DockerPlatformContainerDto'] & {
  applicationName?: string | null
}
export type PlatformContainerDetails = Omit<
  OrchestratorApiSchemas['DockerPlatformContainerDetailsDto'],
  'container'
> & {
  container: PlatformContainer
}
export type PlatformContainerLog = OrchestratorApiSchemas['DockerPlatformContainerLogDto']
export type PlatformContainerStats = OrchestratorApiSchemas['DockerPlatformContainerStatsDto']
export type PlatformImagePull = OrchestratorApiSchemas['ContainerImagePullJobDto']
export type PlatformImage = OrchestratorApiSchemas['DockerPlatformImageDto']
export type PlatformImageDetails = Omit<
  OrchestratorApiSchemas['DockerPlatformImageDetailsDto'],
  'image' | 'relatedContainers'
> & {
  image: PlatformImage
  relatedContainers: PlatformContainer[]
}
export type PlatformNetwork = OrchestratorApiSchemas['DockerPlatformNetworkDto']
export type PlatformNetworkDetails = Omit<
  OrchestratorApiSchemas['DockerPlatformNetworkDetailsDto'],
  'relatedContainers'
> & {
  relatedContainers: PlatformContainer[]
}

type PlatformResourceOwnership = 'managed' | 'all'
export type PlatformUsageFilter = 'all' | 'in-use' | 'unused' | 'unknown'
export type PlatformAttachmentFilter = 'all' | 'attached' | 'unattached'

interface PlatformGridQuery {
  page?: number
  pageSize?: number
  q?: string
  ownership?: PlatformResourceOwnership
  sort?: string
}

export interface PlatformImagesGridQuery extends PlatformGridQuery {
  usage?: PlatformUsageFilter
  runtimeKind?: 'all' | 'redroid' | 'generic'
  androidVersion?: string
  architecture?: string
  gmsMode?: 'all' | 'none' | 'microg' | 'gapps'
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

export interface PlatformContainersGridQuery extends PlatformGridQuery {
  state?: string
  application?: string
  image?: string
  network?: string
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
    applicationNames?: Record<string, string>
    images: string[]
    networks: string[]
  }
}

export interface PlatformNetworksGridQuery extends PlatformGridQuery {
  driver?: string
  dockerScope?: string
  trait?: 'all' | 'internal' | 'attachable' | 'ingress'
  attachment?: PlatformAttachmentFilter
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
export type ContainerImageBuildKind = ContainerImageBuildJob['buildKind']
export type ContainerImageRecipeInput = OrchestratorApiSchemas['CreateContainerImageRecipeDto']
export type StartContainerImageBuildInput = OrchestratorApiSchemas['StartContainerImageBuildDto']

export type GappsBuildPhase = ContainerImageBuildJob['phase']
export type GappsBuildPresetsResponse = OrchestratorApiSchemas['GappsBuildPresetsResponseDto']
export type StartGappsBuildInput = OrchestratorApiSchemas['StartGappsBuildDto']
export type SupportedGappsAndroidVersion = StartGappsBuildInput['androidVersion']
