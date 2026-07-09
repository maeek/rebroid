import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerNetworkRuntimeService } from './services/docker-network-runtime.service';
import { DockerPlatformNetworksService } from './services/docker-platform-networks.service';
import { DOCKER_NETWORK_RUNTIME } from '../contracts/docker-network-runtime.port';
import { DOCKER_PLATFORM_NETWORKS } from '../contracts/docker-platform-networks.port';

@Module({
  imports: [DockerEngineModule],
  providers: [
    DockerNetworkRuntimeService,
    DockerPlatformNetworksService,
    {
      provide: DOCKER_NETWORK_RUNTIME,
      useExisting: DockerNetworkRuntimeService,
    },
    {
      provide: DOCKER_PLATFORM_NETWORKS,
      useExisting: DockerPlatformNetworksService,
    },
  ],
  exports: [
    DockerNetworkRuntimeService,
    DockerPlatformNetworksService,
    DOCKER_NETWORK_RUNTIME,
    DOCKER_PLATFORM_NETWORKS,
  ],
})
export class DockerNetworksModule {}
