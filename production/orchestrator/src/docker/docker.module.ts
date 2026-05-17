import { Module } from '@nestjs/common';
import { DockerEngineService } from './docker-engine.service';
import { DockerHealthService } from './docker-health.service';
import { DockerPlatformService } from './docker-platform.service';
import { DockerRuntimeService } from './docker-runtime.service';
import { DockerSidecarService } from './docker-sidecar.service';

@Module({
  providers: [
    DockerEngineService,
    DockerRuntimeService,
    DockerPlatformService,
    DockerHealthService,
    DockerSidecarService,
  ],
  exports: [
    DockerEngineService,
    DockerRuntimeService,
    DockerPlatformService,
    DockerHealthService,
    DockerSidecarService,
  ],
})
export class DockerModule {}
