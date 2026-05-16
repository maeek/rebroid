import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { NetworkPolicyService } from './network-policy.service';

@Module({
  imports: [DockerModule],
  providers: [NetworkPolicyService],
  exports: [NetworkPolicyService],
})
export class NetworkPolicyModule {}
