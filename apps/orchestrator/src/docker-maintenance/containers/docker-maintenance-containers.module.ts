import { Module } from '@nestjs/common';
import { AndroidAppsModule } from '../../android-apps/android-apps.module';
import { AndroidAppsPersistenceModule } from '../../android-apps/persistence/android-apps-persistence.module';
import { DockerModule } from '../../docker/docker.module';
import { DockerMaintenanceContainersController } from './controllers/docker-maintenance-containers.controller';
import { DockerMaintenanceContainerQueryService } from './services/docker-maintenance-container-query.service';
import { DockerMaintenanceContainerCommandService } from './services/docker-maintenance-container-command.service';
import { DockerTerminalAuthorizationService } from './services/docker-terminal-authorization.service';
import { DockerTerminalSessionService } from './services/docker-terminal-session.service';

@Module({
  imports: [DockerModule, AndroidAppsPersistenceModule, AndroidAppsModule],
  controllers: [DockerMaintenanceContainersController],
  providers: [
    DockerMaintenanceContainerQueryService,
    DockerMaintenanceContainerCommandService,
    DockerTerminalAuthorizationService,
    DockerTerminalSessionService,
  ],
})
export class DockerMaintenanceContainersModule {}
