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

  if (app.status === AndroidApplicationStatus.Error) {
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
          description ??
          `Creating isolated managed network ${app.networkName}.`,
        tone: 'progress',
      };
    case AndroidApplicationLifecycleStage.OrchestratorNetworkConnecting:
      return {
        code: 'orchestrator_network_connecting',
        title: 'Connecting network',
        description:
          description ?? 'Connecting orchestrator to the isolated app network.',
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
        title: errorStatusTitle(app),
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
};
