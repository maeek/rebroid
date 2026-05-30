import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { DockerModule } from '../docker/docker.module';
import { NetworkPolicyService } from './services/network-policy.service';
import { FirewallAgentClientService } from './services/firewall-agent-client.service';
import { NetworkPolicyBootstrapService } from './services/network-policy-bootstrap.service';

@Module({
  imports: [DockerModule, TypeOrmModule.forFeature([AndroidApplication])],
  providers: [
    FirewallAgentClientService,
    NetworkPolicyService,
    NetworkPolicyBootstrapService,
  ],
  exports: [FirewallAgentClientService, NetworkPolicyService],
})
export class NetworkPolicyModule {}
