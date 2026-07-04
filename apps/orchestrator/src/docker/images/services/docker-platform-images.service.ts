import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import { PlatformImage, PlatformImageDetails } from '../../docker.types';
import { shortDockerId } from '../../docker.utils';
import { platformContainerFromInfo } from '../../containers/utils/platform-container.utils';
import {
  platformImageFromInspect,
  platformImageFromSummary,
} from '../utils/platform-image.utils';
import { DockerImageRuntimeService } from './docker-image-runtime.service';
import { DockerImageRuntimeMetadataService } from './docker-image-runtime-metadata.service';
import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/application-core/redroid-runtime';

export interface UpdatePlatformImageRuntimeMetadataInput {
  runtimeKind?: RuntimeImageKind;
  androidVersion?: string | null;
  architecture?: string | null;
  gmsMode?: RuntimeImageGmsMode;
  signatureSpoofing?: RuntimeImageSignatureSpoofing;
}

@Injectable()
export class DockerPlatformImagesService {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly images: DockerImageRuntimeService,
    private readonly metadata: DockerImageRuntimeMetadataService,
  ) {}

  async listPlatformImages(): Promise<PlatformImage[]> {
    const [images, containers] = await Promise.all([
      this.engine.read(
        () => this.engine.docker.listImages({ all: true }),
        'List platform images',
      ),
      this.engine.read(
        () => this.engine.docker.listContainers({ all: true }),
        'List containers for platform image ownership',
      ),
    ]);
    const managedImageIds = new Set(
      containers
        .filter(
          (container) => container.Labels?.['com.rebroid.managed'] === 'true',
        )
        .map((container) => container.ImageID),
    );
    return this.metadata.enrichPlatformImages(
      images.map((image) =>
        platformImageFromSummary(image, managedImageIds.has(image.Id)),
      ),
    );
  }

  async getPlatformImageDetails(
    imageId: string,
  ): Promise<PlatformImageDetails> {
    const image = this.engine.docker.getImage(imageId);
    const inspect = await this.engine.read(
      () => image.inspect(),
      `Inspect platform image ${imageId}`,
    );
    const [images, containers] = await Promise.all([
      this.listPlatformImages(),
      this.engine
        .read(
          () => this.engine.docker.listContainers({ all: true }),
          'List containers for platform image details',
        )
        .then((items) => items.map((item) => platformContainerFromInfo(item))),
    ]);
    const listItem =
      images.find(
        (item) =>
          item.id === inspect.Id ||
          item.shortId === shortDockerId(inspect.Id) ||
          item.repoTags.includes(imageId) ||
          item.repoDigests.includes(imageId),
      ) ??
      (await this.metadata.enrichPlatformImage(
        platformImageFromInspect(inspect),
      ));
    const relatedContainers = containers.filter(
      (container) =>
        container.imageId === listItem.id ||
        container.imageId === inspect.Id ||
        listItem.repoTags.includes(container.image),
    );

    return {
      image: listItem,
      inspect,
      relatedContainers,
    };
  }

  async removePlatformImage(image: string, force = false) {
    try {
      await this.images.removeImage(image, force);
    } catch (error) {
      this.throwImageRemovalError(error);
    }
    return { id: image, removed: true };
  }

  private throwImageRemovalError(error: unknown): never {
    const message = this.engine.errorMessage(error).toLowerCase();
    if (this.engine.isDockerNotFound(error)) {
      throw new NotFoundException('This image no longer exists.');
    }

    if (
      this.engine.isDockerConflict(error) ||
      this.engine.isDockerForbidden(error) ||
      message.includes('is being used by') ||
      message.includes('image is referenced') ||
      message.includes('conflict')
    ) {
      throw new ConflictException(
        'This image is still used by containers or dependent image tags. Remove those containers first, or force remove the image.',
      );
    }

    if (
      this.engine.isTransientDockerTransportError(error) ||
      message.includes('connect') ||
      message.includes('socket') ||
      message.includes('daemon') ||
      message.includes('timeout')
    ) {
      throw new ServiceUnavailableException(
        'Docker is not reachable. Check the Docker service and try again.',
      );
    }

    throw new ConflictException(
      'Docker could not remove this image. Check whether it is still in use, then try again.',
    );
  }

  async updateRuntimeMetadata(
    imageRef: string,
    input: UpdatePlatformImageRuntimeMetadataInput,
  ) {
    const inspect = await this.images.inspectImage(imageRef);
    const existing = await this.metadata.resolveForReference(imageRef, {
      imageId: inspect.Id,
      labels: inspect.Config?.Labels ?? null,
    });
    const runtimeKind = input.runtimeKind ?? existing.metadata.runtimeKind;
    const gmsMode =
      input.gmsMode ??
      (runtimeKind === 'generic' ? 'none' : existing.metadata.gmsMode);
    const signatureSpoofing =
      input.signatureSpoofing ??
      (runtimeKind === 'generic'
        ? 'not_applicable'
        : existing.metadata.signatureSpoofing);

    await this.metadata.upsert({
      imageRef,
      imageId: inspect.Id,
      runtimeKind,
      androidVersion:
        input.androidVersion !== undefined
          ? input.androidVersion
          : existing.metadata.androidVersion,
      architecture:
        input.architecture !== undefined
          ? input.architecture
          : existing.metadata.architecture,
      gmsMode,
      signatureSpoofing,
    });

    return this.getPlatformImageDetails(imageRef);
  }
}
