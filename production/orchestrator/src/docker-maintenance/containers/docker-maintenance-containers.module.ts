import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../../android-apps/android-application.entity';
import { DockerModule } from '../../docker/docker.module';
import { DockerMaintenanceContainersController } from './controllers/docker-maintenance-containers.controller';

@Module({
  imports: [DockerModule, TypeOrmModule.forFeature([AndroidApplication])],
  controllers: [DockerMaintenanceContainersController],
})
export class DockerMaintenanceContainersModule {}
