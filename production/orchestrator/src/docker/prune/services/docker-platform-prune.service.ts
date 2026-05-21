import { Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';

@Injectable()
export class DockerPlatformPruneService {
  constructor(private readonly engine: DockerEngineService) {}

  async pruneImages(danglingOnly = true) {
    return this.engine.docker.pruneImages({
      dangling: danglingOnly ? ['true'] : ['false'],
    });
  }

  async pruneContainers() {
    return this.engine.docker.pruneContainers();
  }

  async pruneNetworks() {
    return this.engine.docker.pruneNetworks();
  }

  async pruneVolumes() {
    return this.engine.docker.pruneVolumes();
  }
}
