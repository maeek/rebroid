import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-client'

export type PlatformContainer = OrchestratorApiSchemas['DockerPlatformContainerDto']
export type PlatformContainerDetails = OrchestratorApiSchemas['DockerPlatformContainerDetailsDto']
export type PlatformContainerLog = OrchestratorApiSchemas['DockerPlatformContainerLogDto']
export type PlatformContainerStats = OrchestratorApiSchemas['DockerPlatformContainerStatsDto']
export type PlatformImage = OrchestratorApiSchemas['DockerPlatformImageDto']
export type PlatformImageDetails = OrchestratorApiSchemas['DockerPlatformImageDetailsDto']
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
