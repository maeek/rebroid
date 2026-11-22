import { ApplicationProfileMode } from '../../contracts/application-profile-mode';

interface AndroidApplicationSavedProfile {
  mode: ApplicationProfileMode;
  name: string;
}

export const parseSavedProfiles = (
  raw: string | null | undefined,
): AndroidApplicationSavedProfile[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const profiles: AndroidApplicationSavedProfile[] = [];
  for (const item of parsed as unknown[]) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('name' in item) ||
      !('mode' in item)
    )
      continue;
    const { mode } = item;
    if (
      typeof item.name !== 'string' ||
      (mode !== ApplicationProfileMode.Persistent &&
        mode !== ApplicationProfileMode.Temporary)
    )
      continue;
    const name = item.name.trim();
    const key = `${mode}:${name}`;
    if (!name || seen.has(key)) continue;
    seen.add(key);
    profiles.push({ mode, name });
  }
  return profiles;
};

export const rememberSavedProfile = (
  raw: string | null | undefined,
  profile: AndroidApplicationSavedProfile,
) => {
  const name = profile.name.trim() || 'default';
  let temporaryProfiles =
    profile.mode === ApplicationProfileMode.Temporary ? 1 : 0;
  const history = parseSavedProfiles(raw).filter((item) => {
    if (item.mode === profile.mode && item.name === name) return false;
    if (item.mode === ApplicationProfileMode.Persistent) return true;
    temporaryProfiles += 1;
    return temporaryProfiles <= 24;
  });
  return JSON.stringify([{ mode: profile.mode, name }, ...history]);
};
