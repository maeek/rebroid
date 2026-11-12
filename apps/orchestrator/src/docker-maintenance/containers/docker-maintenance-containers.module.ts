import { Module } from '@nestjs/common';
import { AndroidAppsModule } from '../../android-apps/android-apps.module';
import { AndroidAppsPersistenceModule } from '../../android-apps/persistence/android-apps-persistence.module';
import { DockerModule } from '../../docker/docker.module';
import { DockerMaintenanceContainersController } from './controllers/docker-maintenance-containers.controller';
import { DockerMaintenanceContainerQueryService } from './services/docker-maintenance-container-query.service';
import { DockerMaintenanceContainerCommandService } from './services/docker-maintenance-container-command.service';

@Module({
  imports: [DockerModule, AndroidAppsPersistenceModule, AndroidAppsModule],
  controllers: [DockerMaintenanceContainersController],
  providers: [
    DockerMaintenanceContainerQueryService,
    DockerMaintenanceContainerCommandService,
  ],
})
export class DockerMaintenanceContainersModule {}
