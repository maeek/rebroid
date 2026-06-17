import { ApplicationProfileMode } from '../../application-profile-mode';
import {
  forgetSavedProfile,
  parseSavedProfiles,
  rememberSavedProfile,
} from './android-apps-profile-history.utils';

describe('android apps profile history utils', () => {
  it('parses valid saved profiles and removes duplicates', () => {
    const raw = JSON.stringify([
      { mode: ApplicationProfileMode.Persistent, name: ' default ' },
      { mode: ApplicationProfileMode.Persistent, name: 'default' },
      { mode: ApplicationProfileMode.Temporary, name: 'temporary' },
      { mode: 'invalid', name: 'bad' },
      { mode: ApplicationProfileMode.Persistent, name: '' },
    ]);

    expect(parseSavedProfiles(raw)).toEqual([
      { mode: ApplicationProfileMode.Persistent, name: 'default' },
      { mode: ApplicationProfileMode.Temporary, name: 'temporary' },
    ]);
  });

  it('returns an empty profile list for corrupted JSON', () => {
    expect(parseSavedProfiles('not-json')).toEqual([]);
  });

  it('remembers a trimmed profile at the front', () => {
    const raw = JSON.stringify([
      { mode: ApplicationProfileMode.Persistent, name: 'default' },
    ]);

    expect(
      JSON.parse(
        rememberSavedProfile(raw, {
          mode: ApplicationProfileMode.Persistent,
          name: ' work ',
        }),
      ),
    ).toEqual([
      { mode: ApplicationProfileMode.Persistent, name: 'work' },
      { mode: ApplicationProfileMode.Persistent, name: 'default' },
    ]);
  });

  it('forgets a saved persistent profile by trimmed name', () => {
    const raw = JSON.stringify([
      { mode: ApplicationProfileMode.Persistent, name: 'default' },
      { mode: ApplicationProfileMode.Persistent, name: 'work' },
    ]);

    expect(
      forgetSavedProfile(raw, {
        mode: ApplicationProfileMode.Persistent,
        name: ' work ',
      }),
    ).toEqual({
      removed: true,
      savedProfilesJson: JSON.stringify([
        { mode: ApplicationProfileMode.Persistent, name: 'default' },
      ]),
    });
  });

  it('reports missing profiles without changing normalized history', () => {
    const raw = JSON.stringify([
      { mode: ApplicationProfileMode.Persistent, name: 'default' },
    ]);

    expect(
      forgetSavedProfile(raw, {
        mode: ApplicationProfileMode.Persistent,
        name: 'missing',
      }),
    ).toEqual({
      removed: false,
      savedProfilesJson: JSON.stringify([
        { mode: ApplicationProfileMode.Persistent, name: 'default' },
      ]),
    });
  });

  it('keeps temporary and persistent profiles separate when forgetting', () => {
    const raw = JSON.stringify([
      { mode: ApplicationProfileMode.Temporary, name: 'default' },
      { mode: ApplicationProfileMode.Persistent, name: 'default' },
    ]);

    expect(
      forgetSavedProfile(raw, {
        mode: ApplicationProfileMode.Persistent,
        name: 'default',
      }),
    ).toEqual({
      removed: true,
      savedProfilesJson: JSON.stringify([
        { mode: ApplicationProfileMode.Temporary, name: 'default' },
      ]),
    });
  });

  it('returns missing against corrupted JSON', () => {
    expect(
      forgetSavedProfile('not-json', {
        mode: ApplicationProfileMode.Persistent,
        name: 'default',
      }),
    ).toEqual({
      removed: false,
      savedProfilesJson: '[]',
    });
  });
});
