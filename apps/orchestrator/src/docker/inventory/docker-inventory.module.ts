import { Module } from '@nestjs/common';
import { DockerEngineModule } from '../engine/docker-engine.module';
import { DockerInventoryService } from './docker-inventory.service';

@Module({
  imports: [DockerEngineModule],
  providers: [DockerInventoryService],
  exports: [DockerInventoryService],
})
export class DockerInventoryModule {}
