import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { SettingsModule } from '../settings/settings.module';
import { ContainerImagesController } from './container-images.controller';

@Module({
  imports: [DockerModule, SettingsModule],
  controllers: [ContainerImagesController],
})
export class ContainerImagesModule {}
