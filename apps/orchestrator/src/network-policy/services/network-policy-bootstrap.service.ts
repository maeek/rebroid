import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { setTimeout as delay } from 'node:timers/promises';
import { AndroidApplication } from '../../android-apps/android-application.entity';
import { AndroidApplicationStatus } from '../../android-apps/android-application-status';
import { NetworkPolicyService } from './network-policy.service';
import { DockerContainerLifecycleService } from '../../docker/containers/services/docker-container-lifecycle.service';

@Injectable()
export class NetworkPolicyBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NetworkPolicyBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly policies: NetworkPolicyService,
    private readonly containers: DockerContainerLifecycleService,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get<boolean>('app.networkPolicy.bootstrap')) {
      this.logger.warn('Firewall policy restore is disabled for this run.');
      return;
    }

    for (let attempt = 1; attempt <= 30; attempt += 1) {
      try {
        const applications = await this.applications.find({
          where: {
            status: AndroidApplicationStatus.Running,
            networkPolicyEnabled: true,
          },
        });
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
    const applications = await this.applications.find({
      where: {
        status: AndroidApplicationStatus.Running,
        networkPolicyEnabled: true,
      },
    });
    for (const app of applications) {
      if (app.containerId) {
        await this.containers.stopContainer(app.containerId);
      }
    }
  }
}
