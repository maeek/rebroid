import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { ContainerImageRuntimeMetadata } from './entities/container-image-runtime-metadata.entity';
import { DockerImageRuntimeMetadataService } from './services/docker-image-runtime-metadata.service';
import { DockerImageRuntimeService } from './services/docker-image-runtime.service';
import { DockerPlatformImagesService } from './services/docker-platform-images.service';

@Module({
  imports: [
    DockerEngineModule,
    TypeOrmModule.forFeature([ContainerImageRuntimeMetadata]),
  ],
  providers: [
    DockerImageRuntimeService,
    DockerImageRuntimeMetadataService,
    DockerPlatformImagesService,
  ],
  exports: [
    DockerImageRuntimeService,
    DockerImageRuntimeMetadataService,
    DockerPlatformImagesService,
  ],
})
export class DockerImagesModule {}
