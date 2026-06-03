import { Module } from '@nestjs/common';
import { DockerContainersModule } from './containers/docker-containers.module';
import { DockerEngineModule } from './engine/docker-engine.module';
import { DockerHealthService } from './health/services/docker-health.service';
import { DockerImagesModule } from './images/docker-images.module';
import { DockerNetworksModule } from './networks/docker-networks.module';
import { DockerPruneModule } from './prune/docker-prune.module';
import { DockerResourcesModule } from './resources/docker-resources.module';
import { DockerSidecarAdbService } from './sidecar/services/docker-sidecar-adb.service';
import { DockerSidecarApiService } from './sidecar/services/docker-sidecar-api.service';
import { DockerSidecarService } from './sidecar/services/docker-sidecar.service';
import { DockerSidecarBuildContextService } from './sidecar/services/docker-sidecar-build-context.service';
import { DockerSidecarNetworkService } from './sidecar/services/docker-sidecar-network.service';

@Module({
  imports: [
    DockerEngineModule,
    DockerContainersModule,
    DockerImagesModule,
    DockerNetworksModule,
    DockerResourcesModule,
    DockerPruneModule,
  ],
  providers: [
    DockerHealthService,
    DockerSidecarAdbService,
    DockerSidecarApiService,
    DockerSidecarNetworkService,
    DockerSidecarBuildContextService,
    DockerSidecarService,
  ],
  exports: [
    DockerEngineModule,
    DockerContainersModule,
    DockerImagesModule,
    DockerNetworksModule,
    DockerResourcesModule,
    DockerPruneModule,
    DockerHealthService,
    DockerSidecarAdbService,
    DockerSidecarApiService,
    DockerSidecarNetworkService,
    DockerSidecarBuildContextService,
    DockerSidecarService,
  ],
})
export class DockerModule {}
