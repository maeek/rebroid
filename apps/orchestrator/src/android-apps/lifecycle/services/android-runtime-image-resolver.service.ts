import { Inject, Injectable } from '@nestjs/common';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../../docker/contracts/docker-engine.port';
import {
  DOCKER_IMAGE_RUNTIME_METADATA,
  type DockerImageRuntimeMetadataPort,
} from '../../../docker/contracts/docker-image-runtime-metadata.port';
import {
  DOCKER_IMAGE_RUNTIME,
  type DockerImageRuntimePort,
} from '../../../docker/contracts/docker-image-runtime.port';
import {
  resolveRuntimeImageMetadata,
  type RuntimeImageKind,
} from '@rebroid/application-core/redroid-runtime';

@Injectable()
export class AndroidRuntimeImageResolverService {
  constructor(
    @Inject(DOCKER_ENGINE)
    private readonly engine: DockerEnginePort,
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    @Inject(DOCKER_IMAGE_RUNTIME_METADATA)
    private readonly metadata: DockerImageRuntimeMetadataPort,
  ) {}

  async resolveKind(image: string): Promise<RuntimeImageKind> {
    try {
      const inspect = await this.images.inspectImage(image);
      const resolved = await this.metadata.resolveForReference(image, {
        imageId: inspect.Id,
        labels: inspect.Config?.Labels ?? null,
      });
      return resolved.metadata.runtimeKind;
    } catch (error) {
      if (!this.engine.isDockerNotFound(error)) {
        throw error;
      }

      return resolveRuntimeImageMetadata({ image }).metadata.runtimeKind;
    }
  }
}
