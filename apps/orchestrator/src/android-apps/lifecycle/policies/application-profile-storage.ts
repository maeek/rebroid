import { runtimeResourceNames } from '../../../network-isolation/runtime-resource-names';
import { selectApplicationProfile } from '../../common/utils/application-profile-selection';
import { parseSavedProfiles } from '../../common/utils/android-apps-profile-history.utils';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';

interface ProfileStorageState {
  id: string;
  name: string;
  profileMode: ApplicationProfileMode;
  profileName: string | null;
  volumeName: string;
  savedProfilesJson: string | null;
}

export class ApplicationProfileStorage {
  private readonly volumeFor: (name: string) => string;
  constructor(
    private readonly app: ProfileStorageState,
    resourcePrefix: string,
  ) {
    this.volumeFor = runtimeResourceNames(app, resourcePrefix).volumeFor;
  }

  select(request: {
    profileMode?: ApplicationProfileMode;
    profileName?: string | null;
  }) {
    const { mode, name } = selectApplicationProfile(this.app, request);
    const volumeName = this.volumeFor(name);
    const admission =
      mode === ApplicationProfileMode.Persistent
        ? this.persistentAdmission(name, volumeName, this.activePersistentName)
        : 'available';
    return { mode, name, volumeName, admission };
  }

  unrecordedCurrentProfile() {
    const activeName = this.activePersistentName;
    if (!activeName) return null;
    const name = activeName.trim() || 'default';
    const { volumeName } = this.app;
    if (
      this.volumeFor(name) !== volumeName ||
      this.persistentAdmission(name, volumeName) !== 'inspect'
    )
      return null;
    return { mode: ApplicationProfileMode.Persistent, name };
  }

  planRemoval(profileName: string) {
    const name = profileName.trim();
    if (!name) return 'missing';
    const activeName = this.activePersistentName;
    if (activeName === name) return 'active';

    const profiles = parseSavedProfiles(this.app.savedProfilesJson);
    const retained = profiles.filter(
      (profile) =>
        profile.mode !== ApplicationProfileMode.Persistent ||
        profile.name !== name,
    );
    if (retained.length === profiles.length) return 'missing';

    const volumeName = this.volumeFor(name);
    if (
      activeName &&
      (this.app.volumeName || this.volumeFor(activeName)) === volumeName
    )
      return 'shared';
    if (
      retained.some(
        (profile) =>
          profile.mode === ApplicationProfileMode.Persistent &&
          this.volumeFor(profile.name) === volumeName,
      )
    )
      return 'shared';
    return { volumeName, savedProfilesJson: JSON.stringify(retained) };
  }

  trackedVolumes() {
    return new Set([
      this.app.volumeName,
      ...parseSavedProfiles(this.app.savedProfilesJson).map(({ name }) =>
        this.volumeFor(name),
      ),
    ]);
  }

  private persistentAdmission(
    name: string,
    volumeName: string,
    activeName?: string,
  ) {
    if (name === activeName) return 'available';
    const names = parseSavedProfiles(this.app.savedProfilesJson)
      .filter(({ mode }) => mode === ApplicationProfileMode.Persistent)
      .map(({ name }) => name);
    // A saved spelling retains access even when it shares a volume with another name.
    if (names.includes(name)) return 'available';
    if (activeName) names.push(activeName);
    return names.some((other) => this.volumeFor(other) === volumeName)
      ? 'shared'
      : 'inspect';
  }

  private get activePersistentName() {
    return this.app.profileMode === ApplicationProfileMode.Persistent
      ? selectApplicationProfile(this.app).name
      : undefined;
  }
}
