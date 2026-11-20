import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageMetadata,
  RuntimeImageMetadataSource,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/android-application-core/redroid-runtime';

export const DOCKER_IMAGE_RUNTIME_METADATA = Symbol(
  'DOCKER_IMAGE_RUNTIME_METADATA',
);

export interface UpsertRuntimeImageMetadataInput {
  imageRef: string;
  imageId?: string | null;
  runtimeKind: RuntimeImageKind;
  androidVersion?: string | null;
  architecture?: string | null;
  gmsMode: RuntimeImageGmsMode;
  signatureSpoofing: RuntimeImageSignatureSpoofing;
}

export interface RuntimeImageMetadataRecord {
  imageRef: string;
  imageId: string | null;
  runtimeKind: RuntimeImageKind;
  androidVersion: string | null;
  architecture: string | null;
  gmsMode: RuntimeImageGmsMode;
  signatureSpoofing: RuntimeImageSignatureSpoofing;
}

export interface ResolvedRuntimeImageMetadata {
  metadata: RuntimeImageMetadata;
  source: RuntimeImageMetadataSource;
}

export interface DockerImageRuntimeMetadataPort {
  upsert(
    input: UpsertRuntimeImageMetadataInput,
  ): Promise<RuntimeImageMetadataRecord>;
  resolveForReference(
    image: string,
    options?: {
      imageId?: string | null;
      labels?: Record<string, string | undefined> | null;
    },
  ): Promise<ResolvedRuntimeImageMetadata>;
}
