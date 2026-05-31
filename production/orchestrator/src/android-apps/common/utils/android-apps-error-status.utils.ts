import {
  AndroidApplication,
  AndroidApplicationError,
} from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../android-application-status';
import {
  extractExitCode,
  isStartupCommandFinishedMessage,
} from './android-apps-status.utils';

export const deriveApplicationError = (
  app: AndroidApplication,
): AndroidApplicationError | null => {
  const message = app.lastError?.trim();
  if (!message) {
    return null;
  }

  const exitCode = extractExitCode(message);
  const phase = deriveApplicationErrorPhase(app, message);

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

  if (message.includes('OOM-killed')) {
    return {
      code: 'container_oom_killed',
      phase,
      message,
      retryable: true,
      exitCode,
      hint: 'The Docker host killed the runtime because it ran out of available memory. Check host memory pressure and the app memory limit before restarting.',
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
};

export const errorStatusTitle = (app: AndroidApplication) => {
  if (app.applicationError?.code === 'startup_command_finished') {
    return 'App stopped immediately';
  }

  if (app.applicationError?.code === 'container_missing') {
    return 'App container is missing';
  }

  if (app.applicationError?.code === 'container_oom_killed') {
    return 'App stopped due to memory pressure';
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
};

export const deriveApplicationErrorPhase = (
  app: AndroidApplication,
  message: string,
): 'provisioning' | 'runtime' | 'unknown' => {
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

  if (app.status === AndroidApplicationStatus.Provisioning) {
    return 'provisioning';
  }

  return 'unknown';
};
