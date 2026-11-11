import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  allowsBroadInternetAccess,
  parseAllowCidrs,
} from '@rebroid/firewall-policy-core/policy';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsPolicyGate } from '../../common/services/android-apps-policy-gate.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { UpdateNetworkPolicyDto } from '../dto/update-network-policy.dto';
import { AndroidAppsRuntimeNetworkService } from './android-apps-runtime-network.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';

@Injectable()
export class AndroidAppsNetworkPolicyService {
  constructor(
    private readonly runtimeNetwork: AndroidAppsRuntimeNetworkService,
    private readonly queries: AndroidAppsQueryService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly writer: AndroidAppsStateWriter,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly features: FeatureFlagsService,
    private readonly policyGate: AndroidAppsPolicyGate,
  ) {}

  /** Saves network policy settings and reapplies them. */
  updateNetworkPolicy(
    id: string,
    dto: UpdateNetworkPolicyDto,
    canUseInternet: boolean,
  ) {
    return this.policyGate.run(id, () =>
      this.saveAndApplyPolicy(id, dto, canUseInternet),
    );
  }

  private async saveAndApplyPolicy(
    id: string,
    dto: UpdateNetworkPolicyDto,
    canUseInternet: boolean,
  ) {
    const app = await this.reconciler.reconcileById(id);
    const restricted = dto.networkPolicyEnabled ?? app.networkPolicyEnabled;
    if (restricted) {
      this.features.assertEnabled('feature.firewall');
    }
    if (
      dto.networkPolicyEnabled !== undefined ||
      dto.networkPolicyAllowCidrs !== undefined
    ) {
      if (
        !canUseInternet &&
        (!restricted ||
          allowsBroadInternetAccess(
            dto.networkPolicyAllowCidrs ??
              parseAllowCidrs(app.networkPolicyAllowCidrs),
          ))
      ) {
        throw new ForbiddenException({
          code: 'network_egress_forbidden',
          message: 'You do not have permission to allow broad internet access.',
        });
      }
      const saved = await this.writer.saveNetworkPolicyConfiguration(id, {
        ...(dto.networkPolicyEnabled === undefined
          ? {}
          : { networkPolicyEnabled: dto.networkPolicyEnabled }),
        ...(dto.networkPolicyAllowCidrs === undefined
          ? {}
          : {
              networkPolicyAllowCidrs: JSON.stringify(
                dto.networkPolicyAllowCidrs,
              ),
            }),
      });
      if (!saved)
        throw new ConflictException(
          'Wait for the app to finish starting before changing its network policy.',
        );
    }
    return this.applyStoredPolicy(id);
  }

  /** Reapplies network policy for one app. */
  applyNetworkPolicy(id: string): Promise<AndroidApplication> {
    return this.policyGate.run(id, () => this.applyStoredPolicy(id));
  }

  private async applyStoredPolicy(id: string) {
    const generation = Date.now();
    const app = await this.reconciler.reconcileById(id);
    if (app.networkPolicyEnabled) {
      this.features.assertEnabled('feature.firewall');
    }
    if (
      app.status === AndroidApplicationStatus.Running &&
      app.networkPolicyEnabled
    ) {
      await this.runtimeNetwork.reapplyRunningPolicy(app, generation);
    } else {
      await this.runtimeNetwork.reconcilePolicy(app, { generation });
    }
    return this.queries.decorate(app);
  }

  /** Rebuilds the agent rule set from stored apps, pruning stale rules. */
  async reconcileNetworkPolicies() {
    const startedAt = Date.now();
    const apps = await this.queries.listStored({});
    await this.networkPolicy.reconcile(apps, startedAt);
    return { reconciled: apps.length };
  }
}
