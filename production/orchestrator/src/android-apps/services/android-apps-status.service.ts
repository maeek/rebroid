import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatUnderscoreLabel } from '../../common/string-format';
import { ContainerRuntimeState } from '../../docker/docker.types';
import {
  AndroidApplication,
  AndroidApplicationError,
  AndroidApplicationStatusDetail,
  AndroidNetworkPolicyResult,
} from '../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../android-application-status';
import {
  extractExitCode,
  isStartupCommandFinishedMessage,
  parseImagePullProgress,
} from '../utils/android-apps-status.utils';

@Injectable()
export class AndroidAppsStatusService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Derives display-only status fields from the persisted application record.
   * The entity is mutated in place before it is returned.
   */
  decorateApplication(app: AndroidApplication) {
    app.imagePullProgress = parseImagePullProgress(
      app.statusMessage,
      app.lifecycleStage,
    );
    app.networkPolicyResult = this.deriveNetworkPolicyResult(app);
    app.applicationError = this.deriveApplicationError(app);
    app.statusDetail = this.deriveStatusDetail(app);
    return app;
  }

  /**
   * Extracts a compact notification list from noisy dumpsys or cmd output.
   * Parsing is heuristic and intentionally capped to recent lines.
   */
  parseNotifications(output: string) {
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /Notification|pkg=|package=/i.test(line))
      .slice(0, 30)
      .map((line) => {
        const packageName =
          line.match(/pkg=([^\s]+)/)?.[1] ??
          line.match(/package=([^\s]+)/)?.[1] ??
          'android';
        const title =
          line.match(/title=([^,]+)/)?.[1]?.trim() ??
          line.match(/tickerText=([^,]+)/)?.[1]?.trim() ??
          packageName;
        const text =
          line.match(/text=([^,]+)/)?.[1]?.trim() ??
          line.match(/content=([^,]+)/)?.[1]?.trim() ??
          line;

        return { packageName, title, text, raw: line };
      });
  }

  /**
   * Builds the stopped message, including whether a fresh container is required next time.
   */
  stoppedStatusMessage(app: AndroidApplication) {
    if (app.recreateContainerOnNextStart) {
      return 'Runtime settings changed. A new container will be created on next start.';
    }

    return app.containerId
      ? 'Application is stopped.'
      : 'Application is stopped. A new container will be created on next start.';
  }

  /**
   * Explains why a managed container stopped, with startup-specific hints when possible.
   */
  containerExitedMessage(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
  ) {
    const status = runtimeState.status ?? 'exited';
    const exitCode =
      runtimeState.exitCode === null || runtimeState.exitCode === undefined
        ? ''
        : ` with exit code ${runtimeState.exitCode}`;
    const dockerError = runtimeState.error
      ? ` Docker reported: ${runtimeState.error}`
      : '';
    const context =
      app.status === AndroidApplicationStatus.Provisioning
        ? ' before provisioning completed'
        : '';

    const startupHint =
      app.status === AndroidApplicationStatus.Provisioning &&
      runtimeState.exitCode === 0
        ? app.containerArgs?.trim()
          ? ' The configured container command completed immediately. Managed apps need a long-running primary process.'
          : ' The image likely finished its default command immediately. Managed apps need a long-running primary process, so plain images such as ubuntu usually require container arguments like "sleep infinity".'
        : '';

    return `Managed container ${status}${exitCode}${context}.${startupHint}${dockerError}`;
  }

  private deriveStatusDetail(
    app: AndroidApplication,
  ): AndroidApplicationStatusDetail {
    const description = app.statusMessage?.trim() || null;

    if (app.status === AndroidApplicationStatus.Error) {
      return {
        code: 'error',
        title: this.errorStatusTitle(app),
        description:
          app.applicationError?.hint ??
          description ??
          'The orchestrator reported an error while preparing the app.',
        tone: 'error',
      };
    }

    if (
      app.status === AndroidApplicationStatus.Stopped &&
      app.recreateContainerOnNextStart
    ) {
      return {
        code: 'stopped_recreate_required',
        title: 'Stopped',
        description:
          description ??
          'Runtime settings changed. A new container will be created on next start.',
        tone: 'warning',
      };
    }

    switch (app.lifecycleStage) {
      case AndroidApplicationLifecycleStage.Queued:
        return {
          code: 'queued',
          title: 'Queued',
          description: description ?? 'Provisioning has been queued.',
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.ImageChecking:
        return {
          code: 'image_checking',
          title: 'Checking image',
          description:
            description ??
            'Checking whether the required container image is already available locally.',
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.ImagePulling:
        return {
          code: 'image_pulling',
          title: 'Pulling image',
          description: description ?? `Pulling ${app.containerImage}.`,
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.VolumeCreating:
        return {
          code: 'volume_creating',
          title: 'Creating storage',
          description:
            description ?? `Creating persistent data volume ${app.volumeName}.`,
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.NetworkCreating:
        return {
          code: 'network_creating',
          title: 'Creating network',
          description:
            description ?? `Creating isolated internal network ${app.networkName}.`,
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.OrchestratorNetworkConnecting:
        return {
          code: 'orchestrator_network_connecting',
          title: 'Connecting network',
          description:
            description ??
            'Connecting orchestrator to the isolated app network.',
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.ContainerCreating:
        return {
          code: 'container_creating',
          title: 'Creating container',
          description:
            description ?? `Creating application container ${app.containerName}.`,
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.ContainerStarting:
        return {
          code: 'container_starting',
          title: 'Starting container',
          description: description ?? 'Starting application container.',
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.AndroidBooting:
        return {
          code: 'android_booting',
          title: 'Booting Android',
          description:
            description ??
            'Waiting for the Android runtime to finish booting inside the managed container.',
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.ApkInstalling:
        return {
          code: 'apk_installing',
          title: 'Installing APK',
          description: description ?? 'Installing APK inside Android.',
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.Ready:
        return {
          code: 'ready',
          title: 'Ready',
          description: description ?? 'Application is running.',
          tone: 'success',
        };
      case AndroidApplicationLifecycleStage.Stopping:
        return {
          code: 'stopping',
          title: 'Stopping app',
          description: description ?? 'Stopping application container.',
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.Stopped:
        return {
          code: 'stopped',
          title: 'Stopped',
          description: description ?? 'Application is stopped.',
          tone: 'neutral',
        };
      case AndroidApplicationLifecycleStage.Removing:
        return {
          code: 'removing',
          title: 'Removing app',
          description:
            description ??
            'Removing application container and network resources.',
          tone: 'progress',
        };
      case AndroidApplicationLifecycleStage.Removed:
        return {
          code: 'removed',
          title: 'Removed',
          description: description ?? 'Application has been removed.',
          tone: 'neutral',
        };
      case AndroidApplicationLifecycleStage.Error:
        return {
          code: 'error',
          title: this.errorStatusTitle(app),
          description:
            app.applicationError?.hint ??
            description ??
            'The orchestrator reported an error while preparing the app.',
          tone: 'error',
        };
      default:
        return {
          code: 'unknown',
          title: formatUnderscoreLabel(app.lifecycleStage),
          description,
          tone: 'neutral',
        };
    }
  }

  private errorStatusTitle(app: AndroidApplication) {
    if (app.applicationError?.code === 'startup_command_finished') {
      return 'App stopped immediately';
    }

    if (app.applicationError?.code === 'container_missing') {
      return 'App container is missing';
    }

    if (app.applicationError?.code === 'container_exited') {
      return app.applicationError.phase === 'runtime'
        ? 'App stopped unexpectedly'
        : 'App failed during startup';
    }

    if (app.applicationError?.code === 'container_command_failed') {
      return 'App setup failed';
    }

    return 'App failed';
  }
  private deriveNetworkPolicyResult(
    app: AndroidApplication,
  ): AndroidNetworkPolicyResult | null {
    const status = app.networkPolicyStatus as
      | 'applied'
      | 'skipped'
      | 'error'
      | null;
    const message = app.networkPolicyMessage?.trim();

    if (!status || !message) {
      return null;
    }

    if (status === 'applied') {
      return {
        status,
        code: 'applied',
        message,
        hint:
          'Outbound access is restricted to the API, the scrcpy sidecar, and any CIDR ranges in the allowlist.',
      };
    }

    if (status === 'error') {
      return {
        status,
        code: 'apply_failed',
        message,
        hint:
          'Check the orchestrator logs and host iptables configuration, then apply the policy again.',
      };
    }

    if (status !== 'skipped') {
      return {
        status,
        code: 'unknown',
        message,
        hint: null,
      };
    }

    if (!this.config.getOrThrow<boolean>('app.docker.iptablesEnabled')) {
      return {
        status,
        code: 'iptables_disabled',
        message,
        hint:
          'Enable IPTABLES_POLICY_ENABLED on the Linux host if you want the orchestrator to enforce outbound restrictions.',
      };
    }

    if (!app.containerId) {
      return {
        status,
        code: 'container_not_created',
        message,
        hint:
          'Start the app first so the orchestrator can create the managed container and attach network rules to it.',
      };
    }

    if (!app.networkPolicyEnabled) {
      return {
        status,
        code: 'policy_disabled',
        message,
        hint:
          'Enable the network policy for this app to restrict outbound traffic again.',
      };
    }

    return {
      status,
      code: 'container_ip_unavailable',
      message,
      hint:
        'The container is not fully ready on its network yet. Try applying the policy again after startup finishes.',
    };
  }

  private deriveApplicationError(
    app: AndroidApplication,
  ): AndroidApplicationError | null {
    const message = app.lastError?.trim();
    if (!message) {
      return null;
    }

    const exitCode = extractExitCode(message);
    const phase = this.deriveApplicationErrorPhase(app, message);

    if (message === 'Managed container no longer exists.') {
      return {
        code: 'container_missing',
        phase,
        message,
        retryable: true,
        exitCode,
        hint: 'Start the app again to create a fresh managed container.',
      };
    }

    if (isStartupCommandFinishedMessage(message)) {
      return {
        code: 'startup_command_finished',
        phase: 'provisioning',
        message,
        retryable: false,
        exitCode,
        hint: app.containerArgs?.trim()
          ? 'The configured container command completed immediately. Managed apps need a long-running primary process.'
          : 'The image finished its default command immediately. Plain images such as ubuntu usually need a long-running command like "sleep infinity".',
      };
    }

    if (message.startsWith('Managed container ')) {
      return {
        code: 'container_exited',
        phase,
        message,
        retryable: phase === 'runtime',
        exitCode,
        hint:
          phase === 'runtime'
            ? 'Restart the app to create a new managed container session.'
            : null,
      };
    }

    if (message.startsWith('Container command failed with exit code ')) {
      return {
        code: 'container_command_failed',
        phase,
        message,
        retryable: false,
        exitCode,
        hint:
          phase === 'provisioning'
            ? 'Check the container logs or Android boot steps to see which setup command failed.'
            : 'Check the container logs to see which runtime command failed.',
      };
    }

    return {
      code: 'unknown',
      phase,
      message,
      retryable: false,
      exitCode,
      hint: null,
    };
  }

  private deriveApplicationErrorPhase(
    app: AndroidApplication,
    message: string,
  ): 'provisioning' | 'runtime' | 'unknown' {
    if (message.includes('before provisioning completed')) {
      return 'provisioning';
    }

    if (app.provisioningStartedAt) {
      if (
        !app.provisioningCompletedAt ||
        app.provisioningStartedAt > app.provisioningCompletedAt
      ) {
        return 'provisioning';
      }
    }

    if (app.lastStartedAt || app.provisioningCompletedAt) {
      return 'runtime';
    }

    return 'unknown';
  }
}