export interface PlatformContainer {
  id: string
  shortId: string
  names: string[]
  image: string
  imageId: string
  command: string
  createdAt: string
  state: string
  status: string
  labels: Record<string, string>
  managed: boolean
  orphaned: boolean
  applicationId: string | null
  component: string | null
  ports: Array<{ privatePort: number; publicPort: number | null; type: string; ip: string | null }>
  networks: string[]
}

export interface PlatformContainerLog {
  source: 'container'
  collectedAt: string
  output: string
}

export interface PlatformImage {
  id: string
  shortId: string
  repoTags: string[]
  repoDigests: string[]
  sizeBytes: number
  sharedSizeBytes: number
  virtualSizeBytes: number
  createdAt: string
  labels: Record<string, string>
  managed: boolean
  containers: number
}

export interface PlatformImageDetails {
  image: PlatformImage
  inspect: unknown
  relatedContainers: PlatformContainer[]
}

export interface PlatformNetwork {
  id: string
  shortId: string
  name: string
  driver: string
  scope: string
  createdAt: string | null
  internal: boolean
  attachable: boolean
  ingress: boolean
  labels: Record<string, string>
  managed: boolean
  containers: string[]
  subnets: string[]
  gateways: string[]
}

export interface PlatformNetworkDetails {
  network: PlatformNetwork
  inspect: unknown
  relatedContainers: PlatformContainer[]
}

export interface PlatformContainerDetails {
  container: PlatformContainer
  inspect: unknown
  relatedImage: PlatformImage | null
  relatedNetworks: PlatformNetwork[]
}
