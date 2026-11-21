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
      volumeName: 'stored-backup',
      savedProfilesJson: JSON.stringify([
        { mode, name: 'current' },
        { mode, name: 'backup' },
        { mode: ApplicationProfileMode.Temporary, name: 'guest' },
      ]),
    },
    {
      namesFor: (_id, _name, profile) => ({
        volumeName: 'stored-' + profile.toLowerCase(),
      }),
    },
  );

  expect(policy.select({ profileName: 'backup' })).toMatchObject({
    admission: 'available',
    volumeName: 'stored-backup',
  });
  expect(policy.planRemoval('backup')).toBe('shared');
  expect(policy.trackedVolumes()).toEqual(
    new Set(['stored-backup', 'stored-current', 'stored-guest']),
  );
});
