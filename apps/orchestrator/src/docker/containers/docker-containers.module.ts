import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerImagesModule } from '../images/docker-images.module';
import { DockerResourcesModule } from '../resources/docker-resources.module';
import { DockerContainerArchiveService } from './services/docker-container-archive.service';
import { DockerContainerExecService } from './services/docker-container-exec.service';
import { DockerContainerLifecycleService } from './services/docker-container-lifecycle.service';
import { DockerContainerProvisioningService } from './services/docker-container-provisioning.service';
import { DockerPlatformContainersService } from './services/docker-platform-containers.service';

@Module({
  imports: [DockerEngineModule, DockerImagesModule, DockerResourcesModule],
  providers: [
    DockerContainerArchiveService,
    DockerContainerExecService,
    DockerContainerLifecycleService,
    DockerContainerProvisioningService,
    DockerPlatformContainersService,
  ],
  exports: [
    DockerContainerArchiveService,
    DockerContainerExecService,
    DockerContainerLifecycleService,
    DockerContainerProvisioningService,
    DockerPlatformContainersService,
  ],
})
export class DockerContainersModule {}
