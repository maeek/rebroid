import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import {
  ANDROID_APPS_RUNTIME_INVENTORY,
  type AndroidAppsRuntimeInventoryPort,
  type RestrictedRuntimePolicyTarget,
} from '../../android-apps/contracts/android-apps-runtime-inventory.port';
import { getErrorMessage } from '../../common/error-message';
import { NetworkPolicyService } from './network-policy.service';
import { NetworkPolicyRuntimeService } from './network-policy-runtime.service';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../docker/contracts/docker-container-lifecycle.port';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';

@Injectable()
export class NetworkPolicyBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NetworkPolicyBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(ANDROID_APPS_RUNTIME_INVENTORY)
    private readonly applications: AndroidAppsRuntimeInventoryPort,
    private readonly policies: NetworkPolicyService,
    private readonly runtimes: NetworkPolicyRuntimeService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly containers: DockerContainerLifecyclePort,
    private readonly features: FeatureFlagsService,
  ) {}

  async onApplicationBootstrap() {
    if (!this.features.isEnabled('feature.firewall')) {
      this.logger.warn(
        'Firewall feature is disabled; existing host rules are left unchanged.',
      );
      return;
    }
    if (!this.config.get<boolean>('app.networkPolicy.bootstrap')) {
      this.logger.warn('Firewall policy restore is disabled for this run.');
      return;
    }

    let unverified: RestrictedRuntimePolicyTarget[] = [];
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      try {
        const startedAt = Date.now();
        const applications =
          await this.applications.findRestrictedRuntimePolicyTargets();
        const result = await this.policies.restoreAtStartup(
          applications,
          startedAt,
        );
        if (result.complete) return;
        unverified = result.unverified;
        this.logger.warn(
          `Firewall policy restore attempt ${attempt} is incomplete.`,
        );
      } catch (error) {
        this.logger.warn(
          `Firewall policy restore attempt ${attempt} failed: ${getErrorMessage(error)}`,
        );
      }
      if (attempt < 30) await delay(1000);
    }
    this.logger.error(
      'Firewall policies could not be restored during startup.',
    );
    await this.stopApplicationsWithUnverifiedPolicies(unverified).catch(
      (stopError) => {
        this.logger.error(
          `Could not stop applications with unverified firewall policies: ${getErrorMessage(stopError)}`,
        );
      },
    );
  }

  private async stopApplicationsWithUnverifiedPolicies(
    unverified: RestrictedRuntimePolicyTarget[],
  ) {
    if (!unverified.length || !this.features.isEnabled('feature.firewall'))
      return;
    for (const previous of unverified) {
      try {
        const runtime = await this.runtimes.observeStartupRuntime(previous);
        if (runtime.state !== 'live') continue;
        const [app] =
          await this.applications.findRestrictedRuntimePolicyTargets([
            previous.id,
          ]);
        if (
          !app ||
          app.id !== previous.id ||
          app.containerId !== previous.containerId ||
          app.networkName !== previous.networkName ||
          app.networkPolicyRevision !== previous.networkPolicyRevision ||
          app.networkPolicyAllowCidrs !== previous.networkPolicyAllowCidrs ||
          !this.features.isEnabled('feature.firewall')
        ) {
          continue;
        }
        await this.containers.stopContainer(app.containerId);
      } catch (error) {
        this.logger.error(
          `Could not stop unverified runtime for ${previous.id}: ${getErrorMessage(error)}`,
        );
      }
    }
  }
}
