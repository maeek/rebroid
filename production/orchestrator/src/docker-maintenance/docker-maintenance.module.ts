import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { SettingsModule } from '../settings/settings.module';
import { DockerMaintenanceController } from './docker-maintenance.controller';
import { ImagePruneService } from './image-prune.service';

@Module({
  imports: [DockerModule, SettingsModule],
  controllers: [DockerMaintenanceController],
  providers: [ImagePruneService],
})
export class DockerMaintenanceModule {}
