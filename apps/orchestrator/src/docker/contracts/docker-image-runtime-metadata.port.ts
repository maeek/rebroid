import type { DockerImageRuntimeMetadataService } from '../images/services/docker-image-runtime-metadata.service';

export const DOCKER_IMAGE_RUNTIME_METADATA = Symbol(
  'DOCKER_IMAGE_RUNTIME_METADATA',
);

export type DockerImageRuntimeMetadataPort = Pick<
  DockerImageRuntimeMetadataService,
  keyof DockerImageRuntimeMetadataService
>;
