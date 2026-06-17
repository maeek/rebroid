import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApplicationProfileMode } from '../../application-profile-mode';
import { AndroidAppsRuntimePreparationService } from './android-apps-runtime-preparation.service';
import type { AndroidApplication } from '../../android-application.entity';

const makeService = () => {
  const resources = {
    removeVolume: jest.fn().mockResolvedValue(undefined),
  };
  const networkIsolation = {
    namesFor: jest.fn().mockReturnValue({ volumeName: 'rebroid-profile-work' }),
  };
  const state = {
    save: jest.fn().mockImplementation(async (app: AndroidApplication) => app),
  };
  const service = new AndroidAppsRuntimePreparationService(
    {} as never,
    {} as never,
    resources as never,
    networkIsolation as never,
    {} as never,
    {} as never,
    {} as never,
    state as never,
  );

  return { networkIsolation, resources, service, state };
};

const makeApp = (patch: Partial<AndroidApplication> = {}): AndroidApplication =>
  ({
    id: 'app-1',
    name: 'Demo',
    profileMode: ApplicationProfileMode.Persistent,
    profileName: 'default',
    savedProfilesJson: JSON.stringify([
      { mode: ApplicationProfileMode.Persistent, name: 'default' },
      { mode: ApplicationProfileMode.Persistent, name: 'work' },
    ]),
    ...patch,
  }) as AndroidApplication;

describe('AndroidAppsRuntimePreparationService profile deletion', () => {
  it('deletes a non-active saved persistent profile and removes its volume', async () => {
    const { networkIsolation, resources, service, state } = makeService();
    const app = makeApp();

    await service.deleteSavedPersistentProfile(app, ' work ');

    expect(networkIsolation.namesFor).toHaveBeenCalledWith(
      'app-1',
      'Demo',
      'work',
    );
    expect(resources.removeVolume).toHaveBeenCalledWith('rebroid-profile-work');
    expect(app.savedProfilesJson).toBe(
      JSON.stringify([
        { mode: ApplicationProfileMode.Persistent, name: 'default' },
      ]),
    );
    expect(state.save).toHaveBeenCalledWith(app);
  });

  it('rejects deleting the active persistent profile', async () => {
    const { resources, service, state } = makeService();
    const app = makeApp();

    await expect(
      service.deleteSavedPersistentProfile(app, 'default'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(resources.removeVolume).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
  });

  it('rejects deleting a missing profile', async () => {
    const { resources, service, state } = makeService();
    const app = makeApp();

    await expect(
      service.deleteSavedPersistentProfile(app, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(resources.removeVolume).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
  });

  it('rejects deleting temporary profiles', async () => {
    const { resources, service, state } = makeService();
    const app = makeApp({
      profileMode: ApplicationProfileMode.Temporary,
      profileName: 'default',
      savedProfilesJson: JSON.stringify([
        { mode: ApplicationProfileMode.Temporary, name: 'temp' },
      ]),
    });

    await expect(
      service.deleteSavedPersistentProfile(app, 'temp'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(resources.removeVolume).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
  });

  it('persists the profile removal when the Docker volume is already missing', async () => {
    const { resources, service, state } = makeService();
    resources.removeVolume.mockResolvedValueOnce(undefined);
    const app = makeApp();

    await service.deleteSavedPersistentProfile(app, 'work');

    expect(resources.removeVolume).toHaveBeenCalledWith('rebroid-profile-work');
    expect(state.save).toHaveBeenCalledWith(app);
  });
});
