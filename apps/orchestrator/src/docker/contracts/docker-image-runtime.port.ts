import type Dockerode from 'dockerode';

export const DOCKER_IMAGE_RUNTIME = Symbol('DOCKER_IMAGE_RUNTIME');

export interface DockerImageRuntimePort {
  imageExists(image: string): Promise<boolean>;
  inspectImage(image: string): Promise<Dockerode.ImageInspectInfo>;
  ensureImage(image: string): Promise<void>;
  pullImage(
    image: string,
    onProgress?: (message: string) => void,
  ): Promise<void>;
  listImages(): Promise<Dockerode.ImageInfo[]>;
  removeImage(
    image: string,
    force?: boolean,
  ): Promise<Dockerode.ImageRemoveInfo[]>;
}
