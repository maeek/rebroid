import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerResourceRuntimeService } from './services/docker-resource-runtime.service';
import { DOCKER_RESOURCE_RUNTIME } from '../contracts/docker-resource-runtime.port';

@Module({
  imports: [DockerEngineModule],
  providers: [
    DockerResourceRuntimeService,
    {
      provide: DOCKER_RESOURCE_RUNTIME,
      useExisting: DockerResourceRuntimeService,
    },
  ],
  exports: [DockerResourceRuntimeService, DOCKER_RESOURCE_RUNTIME],
})
export class DockerResourcesModule {}
