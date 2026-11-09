import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { AndroidAppLifecycleJobKind } from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppsRuntimeActivationService } from './android-apps-runtime-activation.service';

describe('AndroidAppsRuntimeActivationService', () => {
  const setup = (exists: boolean) => {
    const error = new Error('Network or container not found');
    const startContainer = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);
    const createApplicationContainer = jest
      .fn()
      .mockResolvedValue({ id: 'replacement' });
    const createRuntimeBoundary = jest.fn();
    const updateProgress = jest.fn().mockResolvedValue(true);
    const service = new AndroidAppsRuntimeActivationService(
      {} as never,
      {
        startContainer,
        getContainerRuntimeState: jest.fn().mockResolvedValue({ exists }),
      } as never,
      { createApplicationContainer } as never,
      { imageExists: jest.fn().mockResolvedValue(true) } as never,
      { engineSummary: jest.fn().mockResolvedValue({}) } as never,
      { shouldPrepareRemoteAccess: jest.fn().mockReturnValue(false) } as never,
      {
        attachRuntimeSupport: jest.fn(),
        createRuntimeBoundary,
        enforcePolicyAfterStart: jest.fn(),
      } as never,
      { updateProgress } as never,
      { ensureActive: jest.fn() } as never,
      { append: jest.fn() } as never,
    );
    const app = Object.assign(new AndroidApplication(), {
      id: 'app',
      containerId: 'old',
      networkName: 'app-network',
      volumeName: 'saved-profile',
      profileMode: ApplicationProfileMode.Persistent,
    });
    return {
      app,
      service,
      error,
      startContainer,
      createApplicationContainer,
      createRuntimeBoundary,
      updateProgress,
    };
  };

  it('starts a replacement with the same persistent profile if the old container disappears', async () => {
    const {
      app,
      service,
      startContainer,
      createApplicationContainer,
      createRuntimeBoundary,
      updateProgress,
    } = setup(false);
    const kind = AndroidAppLifecycleJobKind.Start;
    await service.activate(app, kind, 'start');

    expect(updateProgress).toHaveBeenCalledWith(
      app.id,
      kind,
      expect.objectContaining({ containerId: null }),
    );
    expect(createRuntimeBoundary).toHaveBeenCalledTimes(1);
    expect(createApplicationContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        volumeName: 'saved-profile',
        persistentData: true,
      }),
    );
    expect(startContainer.mock.calls).toEqual([['old'], ['replacement']]);
    expect(app.containerId).toBe('replacement');
  });

  it('preserves the start failure if the app container still exists', async () => {
    const { app, service, error, createApplicationContainer } = setup(true);
    await expect(
      service.activate(app, AndroidAppLifecycleJobKind.Start, 'start'),
    ).rejects.toBe(error);
    expect(createApplicationContainer).not.toHaveBeenCalled();
  });
});
