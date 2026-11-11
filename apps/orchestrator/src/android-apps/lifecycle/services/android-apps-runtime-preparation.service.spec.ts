import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { AndroidAppsRuntimePreparationService } from './android-apps-runtime-preparation.service';
import type { AndroidApplication } from '../../android-application.entity';
import { dockerSafeName } from '../../../common/docker-name';

const makeService = () => {
  const resources = {
    inspectVolume: jest.fn().mockResolvedValue(null),
    removeVolume: jest.fn().mockResolvedValue(undefined),
  };
  const networkIsolation = {
    namesFor: jest
      .fn()
      .mockImplementation((_id: string, _name: string, profile: string) => ({
        volumeName: `rebroid-profile-${dockerSafeName(profile)}`,
      })),
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

  it('preserves an active volume reached by a differently spelled saved profile', async () => {
    const { service, resources, state } = makeService();
    const app = makeApp({
      profileName: 'Work',
      volumeName: 'rebroid-profile-work',
    });
    await expect(
      service.deleteSavedPersistentProfile(app, 'work'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(resources.removeVolume).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
  });

  it('preserves storage shared by two inactive legacy profiles', async () => {
    const { service, resources } = makeService();
    const app = makeApp({
      savedProfilesJson: JSON.stringify([
        { mode: ApplicationProfileMode.Persistent, name: 'work phone' },
        { mode: ApplicationProfileMode.Persistent, name: 'work-phone' },
      ]),
    });
    await expect(
      service.deleteSavedPersistentProfile(app, 'work phone'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(resources.removeVolume).not.toHaveBeenCalled();
  });

  it.each(['Work', 'work!'])(
    'rejects new storage aliases during profile selection (%s)',
    async (name) => {
      const { service } = makeService();
      const app = makeApp();
      await expect(
        service.switchProfile(app, {
          profileMode: ApplicationProfileMode.Persistent,
          profileName: name,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.prepareRuntimeProfile(app, {
          profileMode: ApplicationProfileMode.Persistent,
          profileName: name,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('permits an existing saved alias to keep accessing its stored data', async () => {
    const { service } = makeService();
    const app = makeApp({
      savedProfilesJson: JSON.stringify([
        { mode: ApplicationProfileMode.Persistent, name: 'work' },
        { mode: ApplicationProfileMode.Persistent, name: 'Work' },
      ]),
    });
    await service.switchProfile(app, {
      profileMode: ApplicationProfileMode.Persistent,
      profileName: 'Work',
    });
    expect(app.profileName).toBe('Work');
    expect(app.volumeName).toBe('rebroid-profile-work');
  });

  it('preserves an existing volume whose original profile is missing from history', async () => {
    const { service, resources, state } = makeService();
    resources.inspectVolume.mockResolvedValue({
      Name: 'rebroid-profile-archived',
    });
    const app = makeApp();
    await expect(
      service.prepareRuntimeProfile(app, { profileName: 'Archived' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(resources.inspectVolume).toHaveBeenCalledWith(
      'rebroid-profile-archived',
    );
    expect(app.profileName).toBe('default');
    expect(state.save).not.toHaveBeenCalled();
  });

  it('admits a new persistent name with an unused volume identity', async () => {
    const { service, resources, state } = makeService();
    const app = makeApp();
    await service.prepareRuntimeProfile(app, { profileName: 'archive' });
    expect(resources.inspectVolume).toHaveBeenCalledWith(
      'rebroid-profile-archive',
    );
    expect(app.volumeName).toBe('rebroid-profile-archive');
    expect(state.save).toHaveBeenCalledWith(app);
  });
});
