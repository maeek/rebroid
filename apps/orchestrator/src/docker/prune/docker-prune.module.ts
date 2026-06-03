import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerPlatformPruneService } from './services/docker-platform-prune.service';

@Module({
  imports: [DockerEngineModule],
  providers: [DockerPlatformPruneService],
  exports: [DockerPlatformPruneService],
})
export class DockerPruneModule {}
