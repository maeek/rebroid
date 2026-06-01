import { Module } from '@nestjs/common';
import { DockerModule } from '../docker.module';
import { DockerSidecarController } from './controllers/docker-sidecar.controller';

@Module({
  imports: [DockerModule],
  controllers: [DockerSidecarController],
})
export class DockerSidecarModule {}
