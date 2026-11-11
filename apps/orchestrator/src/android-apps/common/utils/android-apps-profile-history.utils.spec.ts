import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
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

  it('keeps persistent identities when temporary history rolls over', () => {
    const persistent = {
      mode: ApplicationProfileMode.Persistent,
      name: 'work',
    };
    const temporary = Array.from({ length: 25 }, (_, index) => ({
      mode: ApplicationProfileMode.Temporary,
      name: `temporary-${index}`,
    }));
    const saved = parseSavedProfiles(
      rememberSavedProfile(JSON.stringify([...temporary, persistent]), {
        mode: ApplicationProfileMode.Persistent,
        name: 'new',
      }),
    );
    expect(saved).toContainEqual(persistent);
    expect(
      saved.filter(({ mode }) => mode === ApplicationProfileMode.Temporary),
    ).toHaveLength(24);
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
