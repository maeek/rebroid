import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import {
  parseSavedProfiles,
  rememberSavedProfile,
} from './android-apps-profile-history.utils';

describe('android apps profile history utils', () => {
  it('parses valid saved profiles and removes duplicates', () => {
    const raw = JSON.stringify([
      { mode: ApplicationProfileMode.Persistent, name: ' default ' },
      null,
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
    expect(parseSavedProfiles('{"profiles": []}')).toEqual([]);
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

  it.each([
    ApplicationProfileMode.Temporary,
    ApplicationProfileMode.Persistent,
  ])(
    'keeps persistent identities when remembering a %s profile at the history limit',
    (mode) => {
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
          mode,
          name: 'temporary-12',
        }),
      );
      expect(saved).toContainEqual(persistent);
      expect(saved[0]).toEqual({ mode, name: 'temporary-12' });
      expect(
        saved.filter(({ mode }) => mode === ApplicationProfileMode.Temporary),
      ).toHaveLength(24);
    },
  );
});
