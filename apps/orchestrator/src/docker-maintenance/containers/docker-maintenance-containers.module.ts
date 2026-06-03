import { Module } from '@nestjs/common';
import { AndroidAppsPersistenceModule } from '../../android-apps/persistence/android-apps-persistence.module';
import { DockerModule } from '../../docker/docker.module';
import { DockerMaintenanceContainersController } from './controllers/docker-maintenance-containers.controller';

@Module({
  imports: [DockerModule, AndroidAppsPersistenceModule],
  controllers: [DockerMaintenanceContainersController],
})
export class DockerMaintenanceContainersModule {}
