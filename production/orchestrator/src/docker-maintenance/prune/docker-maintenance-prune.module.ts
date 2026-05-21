import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { DockerMaintenancePruneController } from './controllers/docker-maintenance-prune.controller';

@Module({
  imports: [DockerModule],
  controllers: [DockerMaintenancePruneController],
})
export class DockerMaintenancePruneModule {}
