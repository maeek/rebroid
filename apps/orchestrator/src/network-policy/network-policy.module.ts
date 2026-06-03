import { Module } from '@nestjs/common';
import { AndroidAppsPersistenceModule } from '../android-apps/persistence/android-apps-persistence.module';
import { DockerModule } from '../docker/docker.module';
import { NetworkPolicyService } from './services/network-policy.service';
import { FirewallAgentClientService } from './services/firewall-agent-client.service';
import { NetworkPolicyBootstrapService } from './services/network-policy-bootstrap.service';

@Module({
  imports: [DockerModule, AndroidAppsPersistenceModule],
  providers: [
    FirewallAgentClientService,
    NetworkPolicyService,
    NetworkPolicyBootstrapService,
  ],
  exports: [FirewallAgentClientService, NetworkPolicyService],
})
export class NetworkPolicyModule {}
