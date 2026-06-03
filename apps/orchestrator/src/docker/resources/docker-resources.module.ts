import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerResourceRuntimeService } from './services/docker-resource-runtime.service';

@Module({
  imports: [DockerEngineModule],
  providers: [DockerResourceRuntimeService],
  exports: [DockerResourceRuntimeService],
})
export class DockerResourcesModule {}
