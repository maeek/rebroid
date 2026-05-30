import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { NetworkPolicyModule } from '../network-policy/network-policy.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DockerModule, NetworkPolicyModule],
  controllers: [HealthController],
})
export class HealthModule {}
