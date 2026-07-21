import { Module } from '@nestjs/common';
import { AndroidAppsPersistenceModule } from '../../android-apps/persistence/android-apps-persistence.module';
import { DockerModule } from '../../docker/docker.module';
import { DockerMaintenanceContainersController } from './controllers/docker-maintenance-containers.controller';
import { DockerMaintenanceContainerQueryService } from './services/docker-maintenance-container-query.service';

@Module({
  imports: [DockerModule, AndroidAppsPersistenceModule],
  controllers: [DockerMaintenanceContainersController],
  providers: [DockerMaintenanceContainerQueryService],
})
export class DockerMaintenanceContainersModule {}
