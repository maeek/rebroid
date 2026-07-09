import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import { DockerPlatformImagesService } from './docker-platform-images.service';
import { DockerImageRuntimeMetadataService } from './docker-image-runtime-metadata.service';
import { DockerImageRuntimeService } from './docker-image-runtime.service';

type DockerLikeError = Error & { statusCode?: number; code?: string };

const dockerError = (message: string, options: Partial<DockerLikeError> = {}) =>
  Object.assign(new Error(message), options);

const createService = (
  removeImage: (image: string, force: boolean) => Promise<unknown>,
) => {
  const engine = {
    errorMessage: (error: unknown) =>
      error instanceof Error ? error.message : 'Unknown Docker error',
    isDockerNotFound: (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 404,
    isDockerConflict: (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 409,
    isDockerForbidden: (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 403,
    isTransientDockerTransportError: (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(String(error.code)),
  } satisfies Partial<DockerEngineService>;
  const images = { removeImage } satisfies Partial<DockerImageRuntimeService>;
  const metadata = {} satisfies Partial<DockerImageRuntimeMetadataService>;

  return new DockerPlatformImagesService(
    engine as DockerEngineService,
    images as DockerImageRuntimeService,
    metadata as DockerImageRuntimeMetadataService,
  );
};

describe('DockerPlatformImagesService', () => {
  it('maps missing image removals to a friendly not-found error', async () => {
    const service = createService(
      jest
        .fn()
        .mockRejectedValue(dockerError('No such image', { statusCode: 404 })),
    );

    await expect(service.removePlatformImage('missing-image')).rejects.toThrow(
      new NotFoundException('This image no longer exists.'),
    );
  });

  it('maps image-in-use removal failures to a friendly conflict error', async () => {
    const service = createService(
      jest.fn().mockRejectedValue(
        dockerError(
          'conflict: unable to delete image, image is being used by running container',
          {
            statusCode: 409,
          },
        ),
      ),
    );

    await expect(service.removePlatformImage('used-image')).rejects.toThrow(
      new ConflictException(
        'This image is still used by containers or dependent image tags. Remove those containers first, or force remove the image.',
      ),
    );
  });

  it('maps Docker transport failures to a friendly service-unavailable error', async () => {
    const service = createService(
      jest
        .fn()
        .mockRejectedValue(
          dockerError('socket hang up', { code: 'ECONNRESET' }),
        ),
    );

    await expect(service.removePlatformImage('image')).rejects.toThrow(
      new ServiceUnavailableException(
        'Docker is not reachable. Check the Docker service and try again.',
      ),
    );
  });
});
