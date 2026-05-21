import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { DockerMaintenanceContainersController } from './controllers/docker-maintenance-containers.controller';

@Module({
  imports: [DockerModule],
  controllers: [DockerMaintenanceContainersController],
})
export class DockerMaintenanceContainersModule {}
