import { Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import { PlatformImage, PlatformImageDetails } from '../../docker.types';
import { shortDockerId } from '../../docker.utils';
import { platformContainerFromInfo } from '../../containers/utils/platform-container.utils';
import {
  platformImageFromInspect,
  platformImageFromSummary,
} from '../utils/platform-image.utils';
import { DockerImageRuntimeService } from './docker-image-runtime.service';

@Injectable()
export class DockerPlatformImagesService {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly images: DockerImageRuntimeService,
  ) {}

  async listPlatformImages(): Promise<PlatformImage[]> {
    const images = await this.engine.docker.listImages({ all: true });
    return images.map((image) => platformImageFromSummary(image));
  }

  async getPlatformImageDetails(
    imageId: string,
  ): Promise<PlatformImageDetails> {
    const image = this.engine.docker.getImage(imageId);
    const inspect = await image.inspect();
    const [images, containers] = await Promise.all([
      this.listPlatformImages(),
      this.engine.docker
        .listContainers({ all: true })
        .then((items) => items.map((item) => platformContainerFromInfo(item))),
    ]);
    const listItem =
      images.find(
        (item) =>
          item.id === inspect.Id ||
          item.shortId === shortDockerId(inspect.Id) ||
          item.repoTags.includes(imageId) ||
          item.repoDigests.includes(imageId),
      ) ?? platformImageFromInspect(inspect);
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
    await this.images.removeImage(image, force);
    return { id: image, removed: true };
  }
}
