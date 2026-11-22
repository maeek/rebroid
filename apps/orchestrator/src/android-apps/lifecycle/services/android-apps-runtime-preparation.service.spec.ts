import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { AndroidAppsRuntimePreparationService } from './android-apps-runtime-preparation.service';
import type { AndroidApplication } from '../../android-application.entity';
import { dockerSafeName } from '../../../common/docker-name';
import { redroidDefaultContainerArgs } from '@rebroid/android-application-core/redroid-runtime';

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
    saveFields: jest
      .fn()
      .mockImplementation(async (app: AndroidApplication) => app),
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

it('cleans up stored GPU flags without replacing the existing container', async () => {
  const { service, state } = makeService();
  const args = redroidDefaultContainerArgs.join(' ');
  const app = makeApp({
    containerId: 'existing',
    containerImage: 'redroid/redroid:16',
    runtimeKind: 'redroid',
    containerArgs: `androidboot.redroid_gpu_mode=guest ${args}`,
  });
  expect(
    service.shouldRecreateContainerOnUpdate(app, { containerArgs: args }),
  ).toBe(false);
  await service.prepareRuntimeDefaults(app);
  expect(state.saveFields).toHaveBeenCalledWith(
    expect.objectContaining({
      containerId: 'existing',
      containerArgs: args,
    }),
    'containerArgs',
  );
});

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
    expect(state.saveFields).toHaveBeenCalledWith(app, 'savedProfilesJson');
  });

  it('rejects deleting the active persistent profile', async () => {
    const { resources, service, state } = makeService();
    const app = makeApp();

    await expect(
      service.deleteSavedPersistentProfile(app, 'default'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(resources.removeVolume).not.toHaveBeenCalled();
    expect(state.saveFields).not.toHaveBeenCalled();
  });

  it('rejects deleting a missing profile', async () => {
    const { resources, service, state } = makeService();
    const app = makeApp();

    await expect(
      service.deleteSavedPersistentProfile(app, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(resources.removeVolume).not.toHaveBeenCalled();
    expect(state.saveFields).not.toHaveBeenCalled();
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
    expect(state.saveFields).not.toHaveBeenCalled();
  });

  it('persists the profile removal when the Docker volume is already missing', async () => {
    const { resources, service, state } = makeService();
    resources.removeVolume.mockResolvedValueOnce(undefined);
    const app = makeApp();

    await service.deleteSavedPersistentProfile(app, 'work');

    expect(resources.removeVolume).toHaveBeenCalledWith('rebroid-profile-work');
    expect(state.saveFields).toHaveBeenCalledWith(app, 'savedProfilesJson');
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
    expect(state.saveFields).not.toHaveBeenCalled();
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
    expect(state.saveFields).not.toHaveBeenCalled();
  });

  it('records a newly selected profile on start', async () => {
    const { service, resources } = makeService();
    const app = makeApp();
    const previousHistory = app.savedProfilesJson;
    await service.switchProfile(app, { profileName: 'archive' });
    expect(app.savedProfilesJson).toBe(previousHistory);
    await service.prepareRuntimeProfile(app, {});
    expect(JSON.parse(app.savedProfilesJson!)[0]).toEqual({
      mode: ApplicationProfileMode.Persistent,
      name: 'archive',
    });
    expect(resources.inspectVolume).toHaveBeenCalledTimes(1);
  });

  it.each([
    { profileName: 'legacy', volumeName: 'original-volume' },
    { profileName: 'Work', volumeName: 'rebroid-profile-work' },
    { profileName: 'temporary', profileMode: ApplicationProfileMode.Temporary },
    { profileName: 'work', volumeName: 'rebroid-profile-work' },
  ])(
    'keeps the stored identity and history on a default start of $profileName',
    async (patch) => {
      const { service, resources, state } = makeService();
      const app = makeApp({ ...patch, containerId: 'existing-container' });
      const before = { ...app };
      await service.prepareRuntimeProfile(app, {});
      expect(app).toEqual(before);
      expect(state.saveFields).not.toHaveBeenCalled();
      expect(resources.inspectVolume).not.toHaveBeenCalled();
    },
  );

  it('admits a new persistent name with an unused volume identity', async () => {
    const { service, resources, state } = makeService();
    const app = makeApp();
    await service.prepareRuntimeProfile(app, { profileName: 'archive' });
    expect(resources.inspectVolume).toHaveBeenCalledWith(
      'rebroid-profile-archive',
    );
    expect(app.volumeName).toBe('rebroid-profile-archive');
    expect(state.saveFields).toHaveBeenCalledWith(
      app,
      'profileMode',
      'profileName',
      'volumeName',
      'containerId',
      'savedProfilesJson',
    );
  });
});
