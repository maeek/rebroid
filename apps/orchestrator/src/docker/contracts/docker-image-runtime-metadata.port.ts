import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageMetadata,
  RuntimeImageMetadataSource,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/android-application-core/redroid-runtime';
import type { PlatformImage } from '../docker.types';

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
  findByReferences(
    references: string[],
  ): Promise<RuntimeImageMetadataRecord | null>;
  resolveForReference(
    image: string,
    options?: {
      imageId?: string | null;
      labels?: Record<string, string | undefined> | null;
    },
  ): Promise<ResolvedRuntimeImageMetadata>;
  enrichPlatformImages(images: PlatformImage[]): Promise<PlatformImage[]>;
  enrichPlatformImage(image: PlatformImage): Promise<PlatformImage>;
  toRuntimeMetadata(record: RuntimeImageMetadataRecord): RuntimeImageMetadata;
}
