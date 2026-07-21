import { Module } from '@nestjs/common';
import { AndroidAppsPersistenceModule } from '../android-apps/persistence/android-apps-persistence.module';
import { DockerModule } from '../docker/docker.module';
import { SettingsModule } from '../settings/settings.module';
import { NetworkPolicyService } from './services/network-policy.service';
import { FirewallAgentClientService } from './services/firewall-agent-client.service';
import { NetworkPolicyBootstrapService } from './services/network-policy-bootstrap.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    DockerModule,
    AndroidAppsPersistenceModule,
    SettingsModule,
    FeatureFlagsModule,
  ],
  providers: [
    FirewallAgentClientService,
    NetworkPolicyService,
    NetworkPolicyBootstrapService,
  ],
  exports: [FirewallAgentClientService, NetworkPolicyService],
})
export class NetworkPolicyModule {}
