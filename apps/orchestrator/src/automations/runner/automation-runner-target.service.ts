import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { setTimeout } from 'node:timers/promises';
import type { AutomationDefinition } from '@rebroid/automation-core/definition';
import { AndroidApplicationStatus } from '../../android-apps/contracts/android-application-status';
import { ApplicationProfileMode } from '../../android-apps/contracts/application-profile-mode';
import {
  ANDROID_APPS_AUTOMATION,
  type AndroidAutomationApplication,
  type AndroidAppsAutomationPort,
} from '../../android-apps/contracts/android-apps-automation.port';
import { AutomationRunAuthorizationService } from './automation-run-authorization.service';
import {
  AutomationRunStartPolicy,
  type AdmitAutomationTargetStart,
  type AutomationRunTargetOptions,
} from './automation-runner-options';

type TargetProfile = {
  profileMode: ApplicationProfileMode;
  profileName: string;
};

const matchesProfile = (
  app: AndroidAutomationApplication,
  profile: TargetProfile,
) =>
  app.profileMode === profile.profileMode &&
  (app.profileName || 'default') === profile.profileName;

@Injectable()
export class AutomationRunnerTargetService {
  constructor(
    @Inject(ANDROID_APPS_AUTOMATION)
    private readonly apps: AndroidAppsAutomationPort,
    private readonly authorization: AutomationRunAuthorizationService,
  ) {}

  async prepareTarget({
    ownerUserId,
    targetApplicationId,
    definition,
    options,
    abortSignal,
    admitTargetStart,
  }: {
    ownerUserId: string;
    targetApplicationId: string;
    definition: AutomationDefinition;
    options: AutomationRunTargetOptions;
    abortSignal: AbortSignal;
    admitTargetStart: AdmitAutomationTargetStart;
  }) {
    abortSignal.throwIfAborted();
    const initial = await this.apps.get(targetApplicationId);
    abortSignal.throwIfAborted();
    const currentProfileOnly =
      options.currentProfileOnly === true &&
      options.startPolicy === AutomationRunStartPolicy.RequireRunning;
    const profile: TargetProfile = {
      profileMode: (options.targetProfileMode ??
        (currentProfileOnly
          ? initial.profileMode
          : ApplicationProfileMode.Persistent)) as ApplicationProfileMode,
      profileName:
        options.targetProfileName?.trim() ||
        (currentProfileOnly ? initial.profileName : null) ||
        'default',
    };

    const startRequested =
      initial.status !== AndroidApplicationStatus.Running &&
      options.startPolicy === AutomationRunStartPolicy.StartIfNeeded;
    const profileOverride =
      startRequested &&
      (options.targetProfileMode ||
        options.targetProfileName?.trim() ||
        !matchesProfile(initial, profile))
        ? profile
        : undefined;
    const { canUseInternet, maxOpenApps } =
      await this.authorization.assertAllowed(
        ownerUserId,
        definition,
        targetApplicationId,
        {
          operation: startRequested ? 'start' : 'attach',
          profileMode: currentProfileOnly
            ? undefined
            : (profileOverride?.profileMode ?? options.targetProfileMode),
          profileName: currentProfileOnly
            ? undefined
            : (profileOverride?.profileName ?? options.targetProfileName),
        },
        abortSignal,
      );
    abortSignal.throwIfAborted();

    const current = await this.apps.get(targetApplicationId);
    abortSignal.throwIfAborted();
    if (current.status === AndroidApplicationStatus.Running) {
      return { app: this.assertProfile(current, profile), canUseInternet };
    }
    if (!startRequested) {
      throw new ConflictException(
        'Application must be running before this automation can run.',
      );
    }
    if (!profileOverride && !matchesProfile(current, profile)) {
      throw new ConflictException(
        'Application profile changed before the automation could start it.',
      );
    }

    await admitTargetStart(() =>
      this.apps.start(targetApplicationId, profileOverride, maxOpenApps),
    );
    const app = await this.waitForRunningTarget(
      targetApplicationId,
      abortSignal,
    );
    return { app: this.assertProfile(app, profile), canUseInternet };
  }

  private assertProfile(
    app: AndroidAutomationApplication,
    profile: TargetProfile,
  ) {
    if (!matchesProfile(app, profile)) {
      throw new ConflictException(
        `Application is running with profile "${app.profileName || 'default'}" (${app.profileMode}). Stop it before running automation with profile "${profile.profileName}" (${profile.profileMode}).`,
      );
    }
    return app;
  }

  private async waitForRunningTarget(
    targetApplicationId: string,
    signal: AbortSignal,
  ) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      const app = await this.apps.get(targetApplicationId);
      signal.throwIfAborted();
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
      await setTimeout(1000, undefined, { signal });
    }

    throw new ConflictException(
      'Application did not finish starting before the automation run timeout.',
    );
  }
}
