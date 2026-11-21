import {
  parseSavedProfiles,
  forgetSavedProfile,
} from '../../common/utils/android-apps-profile-history.utils';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';

interface ProfileStorageState {
  id: string;
  name: string;
  profileMode: ApplicationProfileMode;
  profileName: string | null;
  volumeName: string;
  savedProfilesJson: string | null;
}

interface VolumeNaming {
  namesFor(
    applicationId: string,
    appName: string,
    profileName: string,
  ): { volumeName: string };
}

export class ApplicationProfileStorage {
  constructor(
    private readonly app: ProfileStorageState,
    private readonly naming: VolumeNaming,
  ) {}

  select(request: {
    profileMode?: ApplicationProfileMode;
    profileName?: string | null;
  }) {
    const mode = request.profileMode ?? this.app.profileMode;
    const name = request.profileName?.trim() || this.activeName;
    const volumeName = this.volumeFor(name);
    const admission = this.admission(mode, name, volumeName);
    return { mode, name, volumeName, admission };
  }

  planRemoval(profileName: string) {
    const name = profileName.trim();
    if (!name) return 'missing';
    const activePersistent =
      this.app.profileMode === ApplicationProfileMode.Persistent;
    if (activePersistent && this.activeName === name) return 'active';

    const result = forgetSavedProfile(this.app.savedProfilesJson, {
      mode: ApplicationProfileMode.Persistent,
      name,
    });
    if (!result.removed) return 'missing';

    const volumeName = this.volumeFor(name);
    const activeVolume = this.app.volumeName || this.volumeFor(this.activeName);
    if (activePersistent && activeVolume === volumeName) return 'shared';
    if (
      this.savedPersistentNames().some(
        (other) => other !== name && this.volumeFor(other) === volumeName,
      )
    )
      return 'shared';
    return { volumeName, savedProfilesJson: result.savedProfilesJson };
  }

  trackedVolumes() {
    return new Set([
      this.app.volumeName,
      ...parseSavedProfiles(this.app.savedProfilesJson).map(({ name }) =>
        this.volumeFor(name),
      ),
    ]);
  }

  private admission(
    mode: ApplicationProfileMode,
    name: string,
    volumeName: string,
  ) {
    if (mode !== ApplicationProfileMode.Persistent) return 'available';
    const names = this.savedPersistentNames();
    if (this.app.profileMode === ApplicationProfileMode.Persistent)
      names.push(this.activeName);
    // Existing saved spellings retain access even when they resolve to a shared volume.
    if (names.includes(name)) return 'available';
    if (names.some((other) => this.volumeFor(other) === volumeName))
      return 'shared';
    return 'inspect';
  }

  private savedPersistentNames() {
    return parseSavedProfiles(this.app.savedProfilesJson)
      .filter(({ mode }) => mode === ApplicationProfileMode.Persistent)
      .map(({ name }) => name);
  }

  private get activeName() {
    return this.app.profileName || 'default';
  }

  private volumeFor(name: string) {
    return this.naming.namesFor(this.app.id, this.app.name, name).volumeName;
  }
}
