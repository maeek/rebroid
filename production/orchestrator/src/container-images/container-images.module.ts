import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { ContainerImagesController } from './container-images.controller';

@Module({
  imports: [DockerModule],
  controllers: [ContainerImagesController],
})
export class ContainerImagesModule {}
