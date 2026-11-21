import type { AndroidApplication } from '../../android-application.entity';
import { selectApplicationProfile } from '../../common/utils/application-profile-selection';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import type { ApplicationRuntimeFilesQueryDto } from '../dto/application-runtime-files-query.dto';

export const runtimeDownloadTarget = (
  app: Pick<
    AndroidApplication,
    'profileMode' | 'profileName' | 'status' | 'containerId'
  >,
  query: ApplicationRuntimeFilesQueryDto,
) => {
  const profile = selectApplicationProfile(app, query);
  const active = selectApplicationProfile(app);
  if (
    app.containerId &&
    app.status === AndroidApplicationStatus.Running &&
    profile.mode === active.mode &&
    profile.name === active.name
  ) {
    return { kind: 'container', containerId: app.containerId } as const;
  }
  const profileName =
    profile.mode === ApplicationProfileMode.Persistent ? profile.name : null;
  return { kind: 'volume', profileName } as const;
};
