import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { ContainerImageRuntimeMetadata } from './entities/container-image-runtime-metadata.entity';
import { DockerImageRuntimeMetadataService } from './services/docker-image-runtime-metadata.service';
import { DockerImageRuntimeService } from './services/docker-image-runtime.service';
import { DockerPlatformImagesService } from './services/docker-platform-images.service';
import { DOCKER_IMAGE_RUNTIME } from '../contracts/docker-image-runtime.port';
import { DOCKER_IMAGE_RUNTIME_METADATA } from '../contracts/docker-image-runtime-metadata.port';
import { DOCKER_PLATFORM_IMAGES } from '../contracts/docker-platform-images.port';

@Module({
  imports: [
    DockerEngineModule,
    TypeOrmModule.forFeature([ContainerImageRuntimeMetadata]),
  ],
  providers: [
    DockerImageRuntimeService,
    DockerImageRuntimeMetadataService,
    DockerPlatformImagesService,
    { provide: DOCKER_IMAGE_RUNTIME, useExisting: DockerImageRuntimeService },
    {
      provide: DOCKER_IMAGE_RUNTIME_METADATA,
      useExisting: DockerImageRuntimeMetadataService,
    },
    {
      provide: DOCKER_PLATFORM_IMAGES,
      useExisting: DockerPlatformImagesService,
    },
  ],
  exports: [
    DockerImageRuntimeService,
    DockerImageRuntimeMetadataService,
    DockerPlatformImagesService,
    DOCKER_IMAGE_RUNTIME,
    DOCKER_IMAGE_RUNTIME_METADATA,
    DOCKER_PLATFORM_IMAGES,
  ],
})
export class DockerImagesModule {}
