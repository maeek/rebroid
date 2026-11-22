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
