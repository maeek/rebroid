import { Module } from '@nestjs/common';
import { DockerContainersModule } from './containers/docker-containers.module';
import { DockerEngineModule } from './engine/docker-engine.module';
import { DockerHealthService } from './health/services/docker-health.service';
import { DockerImagesModule } from './images/docker-images.module';
import { DockerNetworksModule } from './networks/docker-networks.module';
import { DockerPruneModule } from './prune/docker-prune.module';
import { DockerResourcesModule } from './resources/docker-resources.module';
import { DockerSidecarModule } from './sidecar/docker-sidecar.module';

@Module({
  imports: [
    DockerEngineModule,
    DockerContainersModule,
    DockerImagesModule,
    DockerNetworksModule,
    DockerResourcesModule,
    DockerPruneModule,
    DockerSidecarModule,
  ],
  providers: [DockerHealthService],
  exports: [
    DockerEngineModule,
    DockerContainersModule,
    DockerImagesModule,
    DockerNetworksModule,
    DockerResourcesModule,
    DockerPruneModule,
    DockerSidecarModule,
    DockerHealthService,
  ],
})
export class DockerModule {}
