import { Injectable } from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { UpdateNetworkPolicyDto } from '../dto/update-network-policy.dto';
import { AndroidAppsRuntimeNetworkService } from './android-apps-runtime-network.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';

@Injectable()
export class AndroidAppsNetworkPolicyService {
  constructor(
    private readonly runtimeNetwork: AndroidAppsRuntimeNetworkService,
    private readonly queries: AndroidAppsQueryService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly writer: AndroidAppsStateWriter,
    private readonly networkPolicy: NetworkPolicyService,
  ) {}

  /** Saves network policy settings and reapplies them. */
  async updateNetworkPolicy(id: string, dto: UpdateNetworkPolicyDto) {
    const app = await this.reconciler.reconcileById(id);
    if (dto.networkPolicyEnabled !== undefined) {
      app.networkPolicyEnabled = dto.networkPolicyEnabled;
    }
    if (dto.networkPolicyAllowCidrs !== undefined) {
      app.networkPolicyAllowCidrs = JSON.stringify(dto.networkPolicyAllowCidrs);
    }

    await this.writer.save(app);
    return this.applyNetworkPolicy(id);
  }

  /** Reapplies network policy for one app. */
  async applyNetworkPolicy(id: string): Promise<AndroidApplication> {
    const app = await this.reconciler.reconcileById(id);
    await this.runtimeNetwork.reconcilePolicy(app, {
      failClosed: app.status === AndroidApplicationStatus.Running,
    });
    return this.queries.decorate(app);
  }

  /** Rebuilds the agent rule set from stored apps, pruning stale rules. */
  async reconcileNetworkPolicies() {
    const apps = await this.queries.listStored({});
    await this.networkPolicy.reconcile(apps);
    return { reconciled: apps.length };
  }
}
