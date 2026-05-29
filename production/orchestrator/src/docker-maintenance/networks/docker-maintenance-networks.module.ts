import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { DockerMaintenanceNetworksController } from './controllers/docker-maintenance-networks.controller';

@Module({
  imports: [DockerModule],
  controllers: [DockerMaintenanceNetworksController],
})
export class DockerMaintenanceNetworksModule {}
