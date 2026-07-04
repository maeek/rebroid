import { Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../../docker/docker-engine.service';
import { DockerImageRuntimeMetadataService } from '../../../docker/images/services/docker-image-runtime-metadata.service';
import { DockerImageRuntimeService } from '../../../docker/images/services/docker-image-runtime.service';
import {
  resolveRuntimeImageMetadata,
  type RuntimeImageKind,
} from '@rebroid/application-core/redroid-runtime';

@Injectable()
export class AndroidRuntimeImageResolverService {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly images: DockerImageRuntimeService,
    private readonly metadata: DockerImageRuntimeMetadataService,
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
