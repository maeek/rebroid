import { Module } from '@nestjs/common';
import { DockerContainersModule } from '../containers/docker-containers.module';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerImagesModule } from '../images/docker-images.module';
import { DockerNetworksModule } from '../networks/docker-networks.module';
import { DockerSidecarController } from './controllers/docker-sidecar.controller';
import { DockerSidecarAdbService } from './services/docker-sidecar-adb.service';
import { DockerSidecarApiService } from './services/docker-sidecar-api.service';
import { DockerSidecarBuildContextService } from './services/docker-sidecar-build-context.service';
import { DockerSidecarImageService } from './services/docker-sidecar-image.service';
import { DockerSidecarNetworkService } from './services/docker-sidecar-network.service';
import { DockerSidecarService } from './services/docker-sidecar.service';
import { DOCKER_SIDECAR } from '../contracts/docker-sidecar.port';
import { SIDECAR_FEATURE_SYNC } from '../contracts/sidecar-feature-sync.port';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';

@Module({
  imports: [
    DockerEngineModule,
    DockerContainersModule,
    DockerImagesModule,
    DockerNetworksModule,
    FeatureFlagsModule,
  ],
  controllers: [DockerSidecarController],
  providers: [
    DockerSidecarAdbService,
    DockerSidecarApiService,
    DockerSidecarBuildContextService,
    DockerSidecarImageService,
    DockerSidecarNetworkService,
    DockerSidecarService,
    { provide: DOCKER_SIDECAR, useExisting: DockerSidecarService },
    { provide: SIDECAR_FEATURE_SYNC, useExisting: DockerSidecarApiService },
  ],
  exports: [
    DockerSidecarAdbService,
    DockerSidecarApiService,
    DockerSidecarBuildContextService,
    DockerSidecarNetworkService,
    DockerSidecarService,
    DOCKER_SIDECAR,
    SIDECAR_FEATURE_SYNC,
  ],
})
export class DockerSidecarModule {}
