import type Dockerode from 'dockerode';
import type { Readable } from 'node:stream';

export const DOCKER_IMAGE_RUNTIME = Symbol('DOCKER_IMAGE_RUNTIME');

export interface DockerImageBuildRequest {
  context: Readable;
  targetImage: string;
  operationName:
    | 'container_image_build'
    | 'container_image_gapps_patch'
    | 'container_image_gapps_worker_image'
    | 'sidecar_build';
  description: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (message: string, kind: 'output' | 'status' | 'error') => void;
}

export interface DockerImageRuntimePort {
  imageExists(image: string): Promise<boolean>;
  inspectImage(image: string): Promise<Dockerode.ImageInspectInfo>;
  ensureImage(image: string): Promise<void>;
  pullImage(
    image: string,
    onProgress?: (message: string) => void,
  ): Promise<void>;
  buildImage(request: DockerImageBuildRequest): Promise<void>;
  listImages(): Promise<Dockerode.ImageInfo[]>;
  removeImage(
    image: string,
    force?: boolean,
  ): Promise<Dockerode.ImageRemoveInfo[]>;
}
