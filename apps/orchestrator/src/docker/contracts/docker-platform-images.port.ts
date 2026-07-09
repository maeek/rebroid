import type { DockerPlatformImagesService } from '../images/services/docker-platform-images.service';

export const DOCKER_PLATFORM_IMAGES = Symbol('DOCKER_PLATFORM_IMAGES');

export type DockerPlatformImagesPort = Pick<
  DockerPlatformImagesService,
  keyof DockerPlatformImagesService
>;
