import { Injectable } from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { UpdateNetworkPolicyDto } from '../dto/update-network-policy.dto';
import { AndroidAppsRuntimeNetworkService } from './android-apps-runtime-network.service';
import { AndroidApplicationStatus } from '../../android-application-status';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';

@Injectable()
export class AndroidAppsNetworkPolicyService {
  constructor(
    private readonly runtimeNetwork: AndroidAppsRuntimeNetworkService,
    private readonly state: AndroidAppsStateService,
    private readonly networkPolicy: NetworkPolicyService,
  ) {}

  /** Saves network policy settings and reapplies them. */
  async updateNetworkPolicy(id: string, dto: UpdateNetworkPolicyDto) {
    const app = await this.state.get(id);
    if (dto.networkPolicyEnabled !== undefined) {
      app.networkPolicyEnabled = dto.networkPolicyEnabled;
    }
    if (dto.networkPolicyAllowCidrs !== undefined) {
      app.networkPolicyAllowCidrs = JSON.stringify(dto.networkPolicyAllowCidrs);
    }

    await this.state.save(app);
    return this.applyNetworkPolicy(id);
  }

  /** Reapplies network policy for one app. */
  async applyNetworkPolicy(id: string): Promise<AndroidApplication> {
    const app = await this.state.get(id);
    await this.runtimeNetwork.reconcilePolicy(app, {
      failClosed: app.status === AndroidApplicationStatus.Running,
    });
    return this.state.decorateApplication(app);
  }

  /** Rebuilds the agent rule set from stored apps, pruning stale rules. */
  async reconcileNetworkPolicies() {
    const apps = await this.state.list({ reconcile: false });
    await this.networkPolicy.reconcile(apps);
    return { reconciled: apps.length };
  }
}
