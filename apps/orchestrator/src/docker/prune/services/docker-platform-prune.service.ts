import { Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';

@Injectable()
export class DockerPlatformPruneService {
  constructor(private readonly engine: DockerEngineService) {}

  isBusy() {
    return this.engine.hasPendingMutations;
  }

  async pruneImages(danglingOnly = true) {
    return this.engine.mutate(
      () =>
        this.engine.docker.pruneImages({
          dangling: danglingOnly ? ['true'] : ['false'],
        }),
      'Prune Docker images',
    );
  }

  async pruneContainers() {
    return this.engine.mutate(
      () => this.engine.docker.pruneContainers(),
      'Prune Docker containers',
    );
  }

  async pruneNetworks() {
    return this.engine.mutate(
      () => this.engine.docker.pruneNetworks(),
      'Prune Docker networks',
    );
  }

  async pruneVolumes() {
    return this.engine.mutate(
      () => this.engine.docker.pruneVolumes(),
      'Prune Docker volumes',
    );
  }
}
