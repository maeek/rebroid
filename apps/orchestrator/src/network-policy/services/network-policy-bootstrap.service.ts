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
} from '../../android-apps/contracts/android-apps-runtime-inventory.port';
import { NetworkPolicyService } from './network-policy.service';
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

    for (let attempt = 1; attempt <= 30; attempt += 1) {
      try {
        const applications =
          await this.applications.findRunningNetworkPolicyTargets();
        await this.policies.reconcile(applications);
        return;
      } catch (error) {
        this.logger.warn(
          `Firewall policy restore attempt ${attempt} failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        if (attempt < 30) {
          await delay(1000);
        }
      }
    }
    this.logger.error(
      'Firewall policies could not be restored during startup.',
    );
    await this.stopApplicationsWithUnverifiedPolicies().catch((stopError) => {
      this.logger.error(
        `Could not stop applications with unverified firewall policies: ${
          stopError instanceof Error ? stopError.message : 'unknown error'
        }`,
      );
    });
  }

  private async stopApplicationsWithUnverifiedPolicies() {
    const applications =
      await this.applications.findRunningNetworkPolicyTargets();
    for (const app of applications) {
      if (app.containerId) {
        await this.containers.stopContainer(app.containerId);
      }
    }
  }
}
