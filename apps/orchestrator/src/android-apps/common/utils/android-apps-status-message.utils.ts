import { ContainerRuntimeState } from '../../../docker/docker.types';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';

export const stoppedStatusMessage = (app: AndroidApplication) => {
  if (app.recreateContainerOnNextStart) {
    return 'Runtime settings changed. A new container will be created on next start.';
  }

  return app.containerId
    ? 'Application is stopped.'
    : 'Application is stopped. A new container will be created on next start.';
};

export const containerExitedMessage = (
  app: AndroidApplication,
  runtimeState: ContainerRuntimeState,
) => {
  const status = runtimeState.status ?? 'exited';
  const exitCode =
    runtimeState.exitCode === null || runtimeState.exitCode === undefined
      ? ''
      : ` with exit code ${runtimeState.exitCode}`;
  const dockerError = runtimeState.error
    ? ` Docker reported: ${runtimeState.error}`
    : '';
  const oomKilled = runtimeState.oomKilled
    ? ' Docker reported that the container was OOM-killed.'
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

  return `Managed container ${status}${exitCode}${context}.${startupHint}${oomKilled}${dockerError}`;
};
