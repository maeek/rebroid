import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { SettingsModule } from '../../settings/settings.module';
import { DockerMaintenanceImagesController } from './controllers/docker-maintenance-images.controller';
import { ImagePruneService } from './services/image-prune.service';

@Module({
  imports: [DockerModule, SettingsModule],
  controllers: [DockerMaintenanceImagesController],
  providers: [ImagePruneService],
})
export class DockerMaintenanceImagesModule {}
