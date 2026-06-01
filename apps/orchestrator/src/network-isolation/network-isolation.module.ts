import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { NetworkIsolationService } from './network-isolation.service';

@Module({
  imports: [DockerModule],
  providers: [NetworkIsolationService],
  exports: [NetworkIsolationService],
})
export class NetworkIsolationModule {}
