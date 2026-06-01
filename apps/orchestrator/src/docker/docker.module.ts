import { Module } from '@nestjs/common';
import { DockerContainerArchiveService } from './containers/services/docker-container-archive.service';
import { DockerContainerExecService } from './containers/services/docker-container-exec.service';
import { DockerContainerLifecycleService } from './containers/services/docker-container-lifecycle.service';
import { DockerContainerProvisioningService } from './containers/services/docker-container-provisioning.service';
import { DockerPlatformContainersService } from './containers/services/docker-platform-containers.service';
import { DockerEngineService } from './docker-engine.service';
import { DockerHealthService } from './health/services/docker-health.service';
import { DockerImageRuntimeService } from './images/services/docker-image-runtime.service';
import { DockerPlatformImagesService } from './images/services/docker-platform-images.service';
import { DockerNetworkRuntimeService } from './networks/services/docker-network-runtime.service';
import { DockerPlatformNetworksService } from './networks/services/docker-platform-networks.service';
import { DockerPlatformPruneService } from './prune/services/docker-platform-prune.service';
import { DockerResourceRuntimeService } from './resources/services/docker-resource-runtime.service';
import { DockerSidecarService } from './sidecar/services/docker-sidecar.service';
import { DockerSidecarBuildContextService } from './sidecar/services/docker-sidecar-build-context.service';

@Module({
  providers: [
    DockerEngineService,
    DockerContainerArchiveService,
    DockerContainerExecService,
    DockerContainerLifecycleService,
    DockerContainerProvisioningService,
    DockerPlatformContainersService,
    DockerImageRuntimeService,
    DockerPlatformImagesService,
    DockerNetworkRuntimeService,
    DockerPlatformNetworksService,
    DockerPlatformPruneService,
    DockerResourceRuntimeService,
    DockerHealthService,
    DockerSidecarBuildContextService,
    DockerSidecarService,
  ],
  exports: [
    DockerEngineService,
    DockerContainerArchiveService,
    DockerContainerExecService,
    DockerContainerLifecycleService,
    DockerContainerProvisioningService,
    DockerPlatformContainersService,
    DockerImageRuntimeService,
    DockerPlatformImagesService,
    DockerNetworkRuntimeService,
    DockerPlatformNetworksService,
    DockerPlatformPruneService,
    DockerResourceRuntimeService,
    DockerHealthService,
    DockerSidecarBuildContextService,
    DockerSidecarService,
  ],
})
export class DockerModule {}
