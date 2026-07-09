import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { AndroidApplicationStatus } from '../../android-apps/contracts/android-application-status';
import { ApplicationProfileMode } from '../../android-apps/contracts/application-profile-mode';
import {
  ANDROID_APPS_AUTOMATION,
  type AndroidAppsAutomationPort,
} from '../../android-apps/contracts/android-apps-automation.port';
import {
  AutomationRunStartPolicy,
  AutomationRunTargetOptions,
} from './automation-runner-options';

@Injectable()
export class AutomationRunnerTargetService {
  constructor(
    @Inject(ANDROID_APPS_AUTOMATION)
    private readonly apps: AndroidAppsAutomationPort,
  ) {}

  async prepareTarget(
    targetApplicationId: string,
    options: AutomationRunTargetOptions,
  ) {
    const startPolicy =
      options.startPolicy ?? AutomationRunStartPolicy.RequireRunning;
    const requestedProfileMode =
      options.targetProfileMode ?? ApplicationProfileMode.Persistent;
    const requestedProfileName = options.targetProfileName?.trim() || 'default';
    let app = await this.apps.get(targetApplicationId);

    if (app.status === AndroidApplicationStatus.Running) {
      const activeProfileName = app.profileName || 'default';
      if (
        app.profileMode !== requestedProfileMode ||
        activeProfileName !== requestedProfileName
      ) {
        throw new ConflictException(
          `Application is already running with profile "${activeProfileName}" (${app.profileMode}). Stop it before running automation with profile "${requestedProfileName}" (${requestedProfileMode}).`,
        );
      }
      return {
        profileMode: app.profileMode,
        profileName: activeProfileName,
      };
    }

    if (startPolicy !== AutomationRunStartPolicy.StartIfNeeded) {
      throw new ConflictException(
        'Application must be running before this automation can run.',
      );
    }

    await this.apps.start(targetApplicationId, {
      profileMode: requestedProfileMode as ApplicationProfileMode,
      profileName: requestedProfileName,
    });
    app = await this.waitForRunningTarget(targetApplicationId);

    return {
      profileMode: app.profileMode,
      profileName: app.profileName || 'default',
    };
  }

  private async waitForRunningTarget(targetApplicationId: string) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const app = await this.apps.get(targetApplicationId);
      if (app.status === AndroidApplicationStatus.Running) {
        return app;
      }
      if (
        app.status === AndroidApplicationStatus.Error ||
        app.status === AndroidApplicationStatus.Removed ||
        app.status === AndroidApplicationStatus.Removing
      ) {
        throw new ConflictException(
          `Application could not be started for automation run: ${app.statusMessage ?? app.status}.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new ConflictException(
      'Application did not finish starting before the automation run timeout.',
    );
  }
}
