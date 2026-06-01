import type { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../android-application-status';

export const shouldReconcileContainerState = (
  app: Pick<AndroidApplication, 'containerId' | 'status'>,
) =>
  Boolean(app.containerId) &&
  (app.status === AndroidApplicationStatus.Provisioning ||
    app.status === AndroidApplicationStatus.Running ||
    app.status === AndroidApplicationStatus.Stopped ||
    app.status === AndroidApplicationStatus.Error);
