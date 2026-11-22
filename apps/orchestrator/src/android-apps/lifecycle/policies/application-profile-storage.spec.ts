import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { ApplicationProfileStorage } from './application-profile-storage';

it('protects the recorded active volume and deduplicates tracked storage on full removal', () => {
  const mode = ApplicationProfileMode.Persistent;
  const policy = new ApplicationProfileStorage(
    {
      id: 'app',
      name: 'Application',
      profileMode: mode,
      profileName: 'current',
      volumeName: 'stored-data-application-backup-app',
      savedProfilesJson: JSON.stringify([
        { mode, name: 'current' },
        { mode, name: 'backup' },
        { mode: ApplicationProfileMode.Temporary, name: 'guest' },
      ]),
    },
    'stored',
  );

  expect(policy.select({ profileName: 'backup' })).toMatchObject({
    admission: 'available',
    volumeName: 'stored-data-application-backup-app',
  });
  expect(policy.planRemoval('backup')).toBe('shared');
  expect(policy.trackedVolumes()).toEqual(
    new Set([
      'stored-data-application-backup-app',
      'stored-data-application-current-app',
      'stored-data-application-guest-app',
    ]),
  );
});

it('removes only the requested persistent identity and keeps normalized history order', () => {
  const mode = ApplicationProfileMode.Persistent;
  const guest = { mode: ApplicationProfileMode.Temporary, name: 'work' };
  const current = { mode, name: 'current' };
  const app = {
    id: 'app',
    name: 'Application',
    profileMode: mode,
    profileName: 'current',
    volumeName: '',
    savedProfilesJson: JSON.stringify([
      guest,
      { mode, name: ' work ' },
      current,
      current,
    ]),
  };
  const policy = new ApplicationProfileStorage(app, 'stored');
  expect(policy.planRemoval(' work ')).toEqual({
    volumeName: 'stored-data-application-work-app',
    savedProfilesJson: JSON.stringify([guest, current]),
  });
  expect(policy.planRemoval('missing')).toBe('missing');
  expect(
    new ApplicationProfileStorage(
      { ...app, savedProfilesJson: 'bad' },
      'stored',
    ).planRemoval('work'),
  ).toBe('missing');
});
