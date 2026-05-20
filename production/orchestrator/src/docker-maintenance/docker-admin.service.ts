import { Injectable } from '@nestjs/common';
import { DockerPlatformService } from '../docker/docker-platform.service';
import { PruneImagesDto } from './dto/prune-images.dto';

@Injectable()
export class DockerAdminService {
  constructor(private readonly docker: DockerPlatformService) {}

  listContainers() {
    return this.docker.listPlatformContainers();
  }

  getContainer(id: string) {
    return this.docker.getPlatformContainerDetails(id);
  }

  getContainerLogs(id: string, tail?: number) {
    return this.docker.getPlatformContainerLogs(id, tail);
  }

  stopContainer(id: string) {
    return this.docker.stopPlatformContainer(id);
  }

  removeContainer(id: string, force = false) {
    return this.docker.removePlatformContainer(id, force);
  }

  listImages() {
    return this.docker.listPlatformImages();
  }

  getImage(id: string) {
    return this.docker.getPlatformImageDetails(decodeURIComponent(id));
  }

  removeImage(id: string, force = false) {
    return this.docker.removePlatformImage(decodeURIComponent(id), force);
  }

  listNetworks() {
    return this.docker.listPlatformNetworks();
  }

  getNetwork(id: string) {
    return this.docker.getPlatformNetworkDetails(id);
  }

  removeNetwork(id: string) {
    return this.docker.removePlatformNetwork(id);
  }

  pruneImages(query: PruneImagesDto) {
    return this.docker.pruneImages(query.danglingOnly ?? true);
  }

  pruneContainers() {
    return this.docker.pruneContainers();
  }

  pruneNetworks() {
    return this.docker.pruneNetworks();
  }

  pruneVolumes() {
    return this.docker.pruneVolumes();
  }

  async pruneAll() {
    const [containers, networks, images, volumes] = await Promise.all([
      this.pruneContainers(),
      this.pruneNetworks(),
      this.docker.pruneImages(true),
      this.pruneVolumes(),
    ]);

    return {
      containers,
      networks,
      images,
      volumes,
    };
  }
}
