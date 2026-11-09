import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
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
} from '@rebroid/android-application-core/redroid-runtime';

const connectionErrorCodes = new Set([
  'EACCES',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENOENT',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPERM',
]);

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
    const inspect = await this.inspectImage(image);
    if (!inspect)
      return resolveRuntimeImageMetadata({ image }).metadata.runtimeKind;

    const resolved = await this.metadata.resolveForReference(image, {
      imageId: inspect.Id,
      labels: inspect.Config?.Labels ?? null,
    });
    return resolved.metadata.runtimeKind;
  }

  private async inspectImage(image: string) {
    try {
      return await this.images.inspectImage(image);
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) return null;
      if (
        (error instanceof Error &&
          'code' in error &&
          typeof error.code === 'string' &&
          connectionErrorCodes.has(error.code)) ||
        this.engine.isTransientDockerTransportError(error)
      ) {
        throw new ServiceUnavailableException(
          {
            statusCode: 503,
            code: 'container_engine_unavailable',
            message: 'The container engine is unavailable.',
          },
          { cause: error },
        );
      }
      throw error;
    }
  }
}
