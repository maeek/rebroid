import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DockerModule],
  controllers: [HealthController],
})
export class HealthModule {}
