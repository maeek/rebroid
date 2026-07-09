import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerImagesModule } from '../images/docker-images.module';
import { DockerResourcesModule } from '../resources/docker-resources.module';
import { DockerContainerArchiveService } from './services/docker-container-archive.service';
import { DockerContainerExecService } from './services/docker-container-exec.service';
import { DockerContainerLifecycleService } from './services/docker-container-lifecycle.service';
import { DockerContainerProvisioningService } from './services/docker-container-provisioning.service';
import { DockerPlatformContainersService } from './services/docker-platform-containers.service';
import { DOCKER_CONTAINER_ARCHIVE } from '../contracts/docker-container-archive.port';
import { DOCKER_CONTAINER_EXEC } from '../contracts/docker-container-exec.port';
import { DOCKER_CONTAINER_LIFECYCLE } from '../contracts/docker-container-lifecycle.port';
import { DOCKER_CONTAINER_PROVISIONING } from '../contracts/docker-container-provisioning.port';
import { DOCKER_PLATFORM_CONTAINERS } from '../contracts/docker-platform-containers.port';

@Module({
  imports: [DockerEngineModule, DockerImagesModule, DockerResourcesModule],
  providers: [
    DockerContainerArchiveService,
    DockerContainerExecService,
    DockerContainerLifecycleService,
    DockerContainerProvisioningService,
    DockerPlatformContainersService,
    {
      provide: DOCKER_CONTAINER_ARCHIVE,
      useExisting: DockerContainerArchiveService,
    },
    { provide: DOCKER_CONTAINER_EXEC, useExisting: DockerContainerExecService },
    {
      provide: DOCKER_CONTAINER_LIFECYCLE,
      useExisting: DockerContainerLifecycleService,
    },
    {
      provide: DOCKER_CONTAINER_PROVISIONING,
      useExisting: DockerContainerProvisioningService,
    },
    {
      provide: DOCKER_PLATFORM_CONTAINERS,
      useExisting: DockerPlatformContainersService,
    },
  ],
  exports: [
    DockerContainerArchiveService,
    DockerContainerExecService,
    DockerContainerLifecycleService,
    DockerContainerProvisioningService,
    DockerPlatformContainersService,
    DOCKER_CONTAINER_ARCHIVE,
    DOCKER_CONTAINER_EXEC,
    DOCKER_CONTAINER_LIFECYCLE,
    DOCKER_CONTAINER_PROVISIONING,
    DOCKER_PLATFORM_CONTAINERS,
  ],
})
export class DockerContainersModule {}
