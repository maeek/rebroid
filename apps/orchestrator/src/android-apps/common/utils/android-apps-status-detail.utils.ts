import { formatUnderscoreLabel } from '../../../common/string-format';
import {
  AndroidApplication,
  AndroidApplicationStatusDetail,
} from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { errorStatusTitle } from './android-apps-error-status.utils';

export const deriveStatusDetail = (
  app: AndroidApplication,
): AndroidApplicationStatusDetail => {
  const description = app.statusMessage?.trim() || null;

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

  if (
    app.status === AndroidApplicationStatus.Error ||
    app.lifecycleStage === AndroidApplicationLifecycleStage.Error
  ) {
    return {
      code: 'error',
      title: errorStatusTitle(app),
      description:
        app.applicationError?.hint ??
        description ??
        'The orchestrator reported an error while preparing the app.',
      tone: 'error',
    };
  }

  const detail = (
    title: string,
    fallback: string,
    tone: AndroidApplicationStatusDetail['tone'] = 'progress',
  ): AndroidApplicationStatusDetail => ({
    code: app.lifecycleStage,
    title,
    description: description ?? fallback,
    tone,
  });

  switch (app.lifecycleStage) {
    case AndroidApplicationLifecycleStage.Queued:
      return detail('Queued', 'Provisioning has been queued.');
    case AndroidApplicationLifecycleStage.ImageChecking:
      return detail(
        'Checking image',
        'Checking whether the required container image is already available locally.',
      );
    case AndroidApplicationLifecycleStage.ImagePulling:
      return detail('Pulling image', `Pulling ${app.containerImage}.`);
    case AndroidApplicationLifecycleStage.VolumeCreating:
      return detail(
        'Creating storage',
        `Creating persistent data volume ${app.volumeName}.`,
      );
    case AndroidApplicationLifecycleStage.NetworkCreating:
      return detail(
        'Creating network',
        `Creating isolated managed network ${app.networkName}.`,
      );
    case AndroidApplicationLifecycleStage.OrchestratorNetworkConnecting:
      return detail(
        'Connecting network',
        'Connecting orchestrator to the isolated app network.',
      );
    case AndroidApplicationLifecycleStage.ContainerCreating:
      return detail(
        'Creating container',
        `Creating application container ${app.containerName}.`,
      );
    case AndroidApplicationLifecycleStage.ContainerStarting:
      return detail('Starting container', 'Starting application container.');
    case AndroidApplicationLifecycleStage.AndroidBooting:
      return detail(
        description === 'Preparing Android remote access.'
          ? 'Preparing Android remote access'
          : 'Booting Android',
        'Waiting for the Android runtime to finish booting inside the managed container.',
      );
    case AndroidApplicationLifecycleStage.ApkInstalling:
      return detail('Installing APK', 'Installing APK inside Android.');
    case AndroidApplicationLifecycleStage.Ready:
      return detail('Ready', 'Application is running.', 'success');
    case AndroidApplicationLifecycleStage.Stopping:
      return detail('Stopping app', 'Stopping application container.');
    case AndroidApplicationLifecycleStage.Stopped:
      return detail('Stopped', 'Application is stopped.', 'neutral');
    case AndroidApplicationLifecycleStage.Removing:
      return detail(
        'Removing app',
        'Removing application container and network resources.',
      );
    case AndroidApplicationLifecycleStage.Removed:
      return detail('Removed', 'Application has been removed.', 'neutral');
    default:
      return {
        code: 'unknown',
        title: formatUnderscoreLabel(app.lifecycleStage),
        description,
        tone: 'neutral',
      };
  }
};
