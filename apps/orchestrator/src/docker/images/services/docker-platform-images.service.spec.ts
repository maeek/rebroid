import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import { DockerInventoryService } from '../../inventory/docker-inventory.service';
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
    {} as DockerInventoryService,
  );
};

describe('DockerPlatformImagesService', () => {
  it.each([true, false])(
    'enriches only the requested image (listed=%s)',
    async (listed) => {
      const imageInfo = {
        Id: 'sha256:image-1',
        RepoTags: ['example/image:latest'],
        RepoDigests: [],
        Size: 10,
        Created: 1,
        Labels: {},
      };
      const inspect = {
        Id: imageInfo.Id,
        RepoTags: imageInfo.RepoTags,
        RepoDigests: [],
        Size: 10,
        Created: new Date(1000).toISOString(),
        Config: { Labels: {} },
      };
      const otherImage = {
        ...imageInfo,
        Id: 'sha256:image-2',
      };
      const listImages = jest
        .fn()
        .mockResolvedValue(listed ? [otherImage, imageInfo] : [otherImage]);
      const listContainers = jest.fn().mockResolvedValue([]);
      const inspectImage = jest.fn().mockResolvedValue(inspect);
      const engine = {
        docker: {
          listImages,
          listContainers,
          getImage: jest.fn().mockReturnValue({ inspect: inspectImage }),
        },
        read: jest.fn((operation: () => Promise<unknown>) => operation()),
      };
      const metadata = {
        enrichPlatformImage: jest.fn(async (image: unknown) => image),
      };
      const service = new DockerPlatformImagesService(
        engine as never,
        {} as never,
        metadata as never,
        new DockerInventoryService(engine as never),
      );

      const details = await service.getPlatformImageDetails(
        imageInfo.RepoTags[0],
      );

      expect(details.image.id).toBe(imageInfo.Id);
      expect(listImages).toHaveBeenCalledTimes(1);
      expect(listContainers).toHaveBeenCalledTimes(1);
      expect(inspectImage).toHaveBeenCalledTimes(1);
      expect(metadata.enrichPlatformImage).toHaveBeenCalledTimes(1);
      expect(metadata.enrichPlatformImage).toHaveBeenCalledWith(
        expect.objectContaining({ id: imageInfo.Id }),
        imageInfo.RepoTags[0],
      );
    },
  );

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
