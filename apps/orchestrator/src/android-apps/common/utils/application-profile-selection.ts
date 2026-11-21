import type { ApplicationProfileMode } from '../../contracts/application-profile-mode';

interface ProfileSelection {
  profileMode: ApplicationProfileMode;
  profileName: string | null;
}

export const selectApplicationProfile = (
  current: ProfileSelection,
  requested: Partial<ProfileSelection> = {},
) => ({
  mode: requested.profileMode ?? current.profileMode,
  name: requested.profileName?.trim() || current.profileName || 'default',
});
