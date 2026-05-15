import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { DockerMaintenanceController } from './docker-maintenance.controller';

@Module({
  imports: [DockerModule],
  controllers: [DockerMaintenanceController],
})
export class DockerMaintenanceModule {}
