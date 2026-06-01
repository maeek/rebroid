import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { SystemResourcesController } from './system-resources.controller';
import { SystemResourcesService } from './system-resources.service';

@Module({
  imports: [DockerModule],
  controllers: [SystemResourcesController],
  providers: [SystemResourcesService],
})
export class SystemResourcesModule {}
