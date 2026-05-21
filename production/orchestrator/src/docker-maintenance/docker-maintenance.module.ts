import { Module } from '@nestjs/common';
import { DockerMaintenanceContainersModule } from './containers/docker-maintenance-containers.module';
import { DockerMaintenanceImagesModule } from './images/docker-maintenance-images.module';
import { DockerMaintenanceNetworksModule } from './networks/docker-maintenance-networks.module';
import { DockerMaintenancePruneModule } from './prune/docker-maintenance-prune.module';

@Module({
  imports: [
    DockerMaintenanceContainersModule,
    DockerMaintenanceImagesModule,
    DockerMaintenanceNetworksModule,
    DockerMaintenancePruneModule,
  ],
})
export class DockerMaintenanceModule {}
