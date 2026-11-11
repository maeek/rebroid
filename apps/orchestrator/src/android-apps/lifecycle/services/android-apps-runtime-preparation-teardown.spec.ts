import { AndroidAppsRuntimePreparationService } from './android-apps-runtime-preparation.service';
import type { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';

const setup = () => {
  const lifecycle = { removeContainer: jest.fn().mockResolvedValue(undefined) };
  const networkPolicy = { remove: jest.fn().mockResolvedValue(undefined) };
  const service = new AndroidAppsRuntimePreparationService(
    {} as never,
    lifecycle as never,
    { inspectVolume: async () => null } as never,
    {
      namesFor: (_id: string, _name: string, profile: string) => ({
        volumeName: profile,
      }),
    } as never,
    networkPolicy as never,
    {} as never,
    { save: async (app: AndroidApplication) => app } as never,
  );
  const app = {
    id: 'app-1',
    name: 'Demo',
    containerId: 'old-container',
    profileMode: ApplicationProfileMode.Persistent,
    profileName: 'default',
    savedProfilesJson: '[]',
    networkPolicyRevision: 7,
  } as AndroidApplication;
  return { service, app, lifecycle, networkPolicy };
};

const operations = [
  'switchProfile',
  'prepareRuntimeProfile',
  'removeManagedContainer',
] as const;

describe.each(operations)('%s firewall teardown', (operation) => {
  it('retains the old policy when Docker removal fails', async () => {
    const { service, app, lifecycle, networkPolicy } = setup();
    lifecycle.removeContainer.mockRejectedValue(
      new Error('engine unavailable'),
    );
    await expect(
      service[operation](app, { profileName: 'work' }),
    ).rejects.toThrow('engine unavailable');
    expect(networkPolicy.remove).not.toHaveBeenCalled();
    expect(app.containerId).toBe('old-container');
  });

  it('removes only the observed container policy after Docker removal succeeds', async () => {
    const { service, app, lifecycle, networkPolicy } = setup();
    await service[operation](app, { profileName: 'work' });
    expect(networkPolicy.remove).toHaveBeenCalledWith(app, 'old-container');
    expect(lifecycle.removeContainer.mock.invocationCallOrder[0]).toBeLessThan(
      networkPolicy.remove.mock.invocationCallOrder[0],
    );
    expect(app.containerId).toBeNull();
  });
});
