import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerImageRuntimeService } from './services/docker-image-runtime.service';
import { DockerPlatformImagesService } from './services/docker-platform-images.service';

@Module({
  imports: [DockerEngineModule],
  providers: [DockerImageRuntimeService, DockerPlatformImagesService],
  exports: [DockerImageRuntimeService, DockerPlatformImagesService],
})
export class DockerImagesModule {}
