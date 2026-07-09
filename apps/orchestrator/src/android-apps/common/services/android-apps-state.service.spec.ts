import { Logger } from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsRuntimeStateReconciler } from './android-apps-runtime-state-reconciler.service';

const createService = (runtimeState: {
  exists: boolean;
  running: boolean;
  status: string | null;
  exitCode: number | null;
  oomKilled: boolean;
  error: string | null;
  finishedAt: string | null;
}) => {
  const applications = {
    save: jest.fn(async (app: AndroidApplication) => app),
  };
  const lifecycle = {
    getContainerRuntimeState: jest.fn().mockResolvedValue(runtimeState),
  };
  const status = {
    decorateApplication: jest.fn((app: AndroidApplication) => app),
    containerExitedMessage: jest
      .fn()
      .mockReturnValue('Managed container exited.'),
  };
  const writer = {
    save: applications.save,
    saveAndDecorate: jest.fn(async (app: AndroidApplication) => {
      await applications.save(app);
      return app;
    }),
  };
  const service = new AndroidAppsRuntimeStateReconciler(
    {} as never,
    lifecycle as never,
    { remove: jest.fn() } as never,
    { cancel: jest.fn() } as never,
    status as never,
    {} as never,
    writer as never,
  );

  return { applications, lifecycle, service };
};

const reconcile = (
  service: AndroidAppsRuntimeStateReconciler,
  app: AndroidApplication,
) => service.reconcileOne(app);

describe('AndroidAppsRuntimeStateReconciler', () => {
  it('does not repeat stopped-container warnings for a recorded terminal error', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { lifecycle, service } = createService({
      exists: true,
      running: false,
      status: 'exited',
      exitCode: 137,
      oomKilled: false,
      error: null,
      finishedAt: '2026-05-31T21:09:16.451613323Z',
    });
    const app = {
      id: 'app-1',
      containerId: 'container-1',
      status: AndroidApplicationStatus.Error,
      lifecycleStage: AndroidApplicationLifecycleStage.Error,
    } as AndroidApplication;

    await reconcile(service, app);

    expect(lifecycle.getContainerRuntimeState).toHaveBeenCalledWith(
      'container-1',
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('still recovers a terminal app when its container was restarted externally', async () => {
    const { applications, service } = createService({
      exists: true,
      running: true,
      status: 'running',
      exitCode: null,
      oomKilled: false,
      error: null,
      finishedAt: null,
    });
    const app = {
      id: 'app-1',
      containerId: 'container-1',
      status: AndroidApplicationStatus.Error,
      lifecycleStage: AndroidApplicationLifecycleStage.Error,
      lastStartedAt: null,
    } as AndroidApplication;

    await reconcile(service, app);

    expect(app.status).toBe(AndroidApplicationStatus.Running);
    expect(app.lifecycleStage).toBe(AndroidApplicationLifecycleStage.Ready);
    expect(applications.save).toHaveBeenCalledWith(app);
  });
});
