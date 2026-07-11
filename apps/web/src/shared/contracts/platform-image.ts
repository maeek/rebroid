import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageMetadataSource,
  RuntimeImageSignatureSpoofing
} from '@rebroid/application-core/redroid-runtime'

export interface PlatformRuntimeImageMetadata {
  runtimeKind: RuntimeImageKind
  androidVersion: string | null
  architecture: string | null
  gmsMode: RuntimeImageGmsMode
  signatureSpoofing: RuntimeImageSignatureSpoofing
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
  runtimeMetadata: PlatformRuntimeImageMetadata | null
  runtimeMetadataSource: RuntimeImageMetadataSource | null
}
