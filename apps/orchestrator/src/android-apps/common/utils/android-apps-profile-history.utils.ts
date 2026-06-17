import { ApplicationProfileMode } from '../../application-profile-mode';

export interface AndroidApplicationSavedProfile {
  mode: ApplicationProfileMode;
  name: string;
}

export const parseSavedProfiles = (
  raw: string | null | undefined,
): AndroidApplicationSavedProfile[] => {
  try {
    const parsed = JSON.parse(raw ?? '[]') as AndroidApplicationSavedProfile[];
    const seen = new Set<string>();
    return parsed
      .filter(
        (profile) =>
          (profile.mode === ApplicationProfileMode.Persistent ||
            profile.mode === ApplicationProfileMode.Temporary) &&
          typeof profile.name === 'string' &&
          profile.name.trim(),
      )
      .map((profile) => ({
        mode: profile.mode,
        name: profile.name.trim(),
      }))
      .filter((profile) => {
        const key = `${profile.mode}:${profile.name}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  } catch {
    return [];
  }
};

export const rememberSavedProfile = (
  raw: string | null | undefined,
  profile: AndroidApplicationSavedProfile,
) => {
  const name = profile.name.trim() || 'default';
  const profiles = [{ mode: profile.mode, name }, ...parseSavedProfiles(raw)];
  const seen = new Set<string>();
  return JSON.stringify(
    profiles
      .filter((item) => {
        const key = `${item.mode}:${item.name}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 24),
  );
};

export const forgetSavedProfile = (
  raw: string | null | undefined,
  profile: AndroidApplicationSavedProfile,
) => {
  const name = profile.name.trim();
  const profiles = parseSavedProfiles(raw);
  let removed = false;
  const savedProfiles = profiles.filter((item) => {
    const matches = item.mode === profile.mode && item.name === name;
    if (matches) {
      removed = true;
      return false;
    }

    return true;
  });

  return {
    removed,
    savedProfilesJson: JSON.stringify(savedProfiles),
  };
};
