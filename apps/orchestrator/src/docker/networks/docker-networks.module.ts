import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerNetworkRuntimeService } from './services/docker-network-runtime.service';
import { DockerPlatformNetworksService } from './services/docker-platform-networks.service';

@Module({
  imports: [DockerEngineModule],
  providers: [DockerNetworkRuntimeService, DockerPlatformNetworksService],
  exports: [DockerNetworkRuntimeService, DockerPlatformNetworksService],
})
export class DockerNetworksModule {}
