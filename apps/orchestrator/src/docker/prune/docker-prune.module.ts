import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerPlatformPruneService } from './services/docker-platform-prune.service';
import { DOCKER_PLATFORM_PRUNE } from '../contracts/docker-platform-prune.port';

@Module({
  imports: [DockerEngineModule],
  providers: [
    DockerPlatformPruneService,
    { provide: DOCKER_PLATFORM_PRUNE, useExisting: DockerPlatformPruneService },
  ],
  exports: [DockerPlatformPruneService, DOCKER_PLATFORM_PRUNE],
})
export class DockerPruneModule {}
