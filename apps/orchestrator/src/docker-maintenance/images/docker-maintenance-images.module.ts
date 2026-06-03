import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { DockerMaintenanceImagesController } from './controllers/docker-maintenance-images.controller';

@Module({
  imports: [DockerModule],
  controllers: [DockerMaintenanceImagesController],
})
export class DockerMaintenanceImagesModule {}
