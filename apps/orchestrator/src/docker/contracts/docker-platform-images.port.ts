import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/application-core/redroid-runtime';
import type { PlatformImage, PlatformImageDetails } from '../docker.types';

export const DOCKER_PLATFORM_IMAGES = Symbol('DOCKER_PLATFORM_IMAGES');

export interface UpdatePlatformImageRuntimeMetadataInput {
  runtimeKind?: RuntimeImageKind;
  androidVersion?: string | null;
  architecture?: string | null;
  gmsMode?: RuntimeImageGmsMode;
  signatureSpoofing?: RuntimeImageSignatureSpoofing;
}

export interface DockerPlatformImagesPort {
  listPlatformImages(): Promise<PlatformImage[]>;
  getPlatformImageDetails(imageId: string): Promise<PlatformImageDetails>;
  removePlatformImage(
    image: string,
    force?: boolean,
  ): Promise<{ id: string; removed: boolean }>;
  updateRuntimeMetadata(
    imageRef: string,
    input: UpdatePlatformImageRuntimeMetadataInput,
  ): Promise<PlatformImageDetails>;
}
