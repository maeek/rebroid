import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { setTimeout } from 'node:timers/promises';
import type { AutomationDefinition } from '@rebroid/automation-core/definition';
import { externalDefinitionIssue } from '@rebroid/automation-core/device-capabilities';
import { AndroidApplicationStatus } from '../../android-apps/contracts/android-application-status';
import { ApplicationProfileMode } from '../../android-apps/contracts/application-profile-mode';
import {
  ANDROID_APPS_AUTOMATION,
  type ManagedAutomationApplication,
  type AndroidAutomationTarget,
  type AndroidAppsAutomationPort,
} from '../../android-apps/contracts/android-apps-automation.port';
import { AutomationRunAuthorizationService } from './automation-run-authorization.service';
import {
  AutomationRunStartPolicy,
  type AdmitAutomationTargetWork,
  type AutomationRunTargetOptions,
} from './automation-runner-options';

type TargetProfile = {
  profileMode: ApplicationProfileMode;
  profileName: string;
};

export type AutomationTargetPreparationPhase =
  'checking-target' | 'starting-app' | 'waiting-for-android';

const matchesProfile = (
  app: ManagedAutomationApplication,
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
    targetDeviceId,
    definition,
    options,
    abortSignal,
    admitTargetWork,
    onPreparationPhase,
  }: {
    ownerUserId: string;
    targetDeviceId: string;
    definition: AutomationDefinition;
    options: AutomationRunTargetOptions;
    abortSignal: AbortSignal;
    admitTargetWork: AdmitAutomationTargetWork;
    onPreparationPhase?: (
      phase: AutomationTargetPreparationPhase,
      profile?: TargetProfile,
    ) => Promise<void>;
  }) {
    abortSignal.throwIfAborted();
    if (onPreparationPhase) await onPreparationPhase('checking-target');
    abortSignal.throwIfAborted();
    const initial = await (this.apps.getAutomationDevice?.(targetDeviceId) ??
      this.apps.get(targetDeviceId));
    abortSignal.throwIfAborted();
    if (initial.kind === 'external' || options.targetKind === 'external') {
      const attachmentId = options.targetAttachmentId;
      if (
        initial.kind !== 'external' ||
        initial.ownerUserId !== ownerUserId ||
        !attachmentId ||
        initial.attachmentId !== attachmentId
      ) {
        throw new ConflictException({
          code: 'external_adb_attachment_changed',
          message:
            'The external device was offline at enqueue or its verified attachment changed.',
        });
      }
      const issue = externalDefinitionIssue(definition);
      if (issue) throw new ConflictException(issue);
      const authorize = (signal?: AbortSignal, command?: string) =>
        this.authorization.assertAllowed(
          ownerUserId,
          definition,
          targetDeviceId,
          { operation: 'attach', attachmentId, ...(command && { command }) },
          signal,
        );
      const permissions = await authorize(abortSignal);
      const target = await this.apps.captureAutomationTarget(
        initial,
        abortSignal,
      );
      return {
        target,
        ...permissions,
        authorizeTarget: async (signal?: AbortSignal, command?: string) => {
          await authorize(signal, command);
        },
      };
    }
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
    const { maxOpenApps, ...permissions } =
      await this.authorization.assertAllowed(
        ownerUserId,
        definition,
        targetDeviceId,
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

    const current = await this.apps.get(targetDeviceId);
    abortSignal.throwIfAborted();
    if (current.status === AndroidApplicationStatus.Running) {
      const target = await this.apps.captureAutomationTarget(
        this.assertProfile(current, profile),
        abortSignal,
      );
      return { target, ...permissions };
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

    if (onPreparationPhase) await onPreparationPhase('starting-app', profile);
    await admitTargetWork(() =>
      this.apps.start(targetDeviceId, profileOverride, maxOpenApps),
    );
    abortSignal.throwIfAborted();
    if (onPreparationPhase)
      await onPreparationPhase('waiting-for-android', profile);
    const app = await this.waitForRunningTarget(targetDeviceId, abortSignal);
    const target = await this.apps.captureAutomationTarget(
      this.assertProfile(app, profile),
      abortSignal,
    );
    return { target, ...permissions };
  }

  assertStillCurrent(target: AndroidAutomationTarget, signal: AbortSignal) {
    return this.apps.withAutomationTarget(
      target,
      signal,
      async () => undefined,
    );
  }

  private assertProfile(
    app: ManagedAutomationApplication,
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
    targetDeviceId: string,
    signal: AbortSignal,
  ) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      const app = await this.apps.get(targetDeviceId);
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
