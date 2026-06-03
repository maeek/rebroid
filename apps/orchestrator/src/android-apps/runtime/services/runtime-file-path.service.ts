import { ConflictException, Injectable } from '@nestjs/common';
import { posix } from 'node:path';
import { ApplicationProfileMode } from '../../application-profile-mode';
import { AndroidApplicationStatus } from '../../android-application-status';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationRuntimeFilesQueryDto } from '../dto/application-runtime-files-query.dto';
import { sanitizeRuntimeFileName } from '../utils/android-apps-runtime-file.utils';

@Injectable()
export class RuntimeFilePathService {
  readonly dataDirectory = '/data';
  readonly downloadDirectory = '/data/media/0/Download';

  normalizeDataPath(requestedPath?: string) {
    const normalized = posix.normalize(
      requestedPath?.trim() || this.dataDirectory,
    );
    if (
      normalized.includes('\0') ||
      (!normalized.startsWith(`${this.dataDirectory}/`) &&
        normalized !== this.dataDirectory)
    ) {
      throw new ConflictException(
        'Path must be inside the runtime data volume.',
      );
    }
    return normalized;
  }

  sanitizeFileName(value: string) {
    return sanitizeRuntimeFileName(value);
  }

  shouldUseRunningContainer(
    app: AndroidApplication,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const profileMode = query.profileMode ?? app.profileMode;
    const profileName =
      query.profileName?.trim() || app.profileName || 'default';

    return (
      app.containerId &&
      app.status === AndroidApplicationStatus.Running &&
      profileMode === app.profileMode &&
      profileName === (app.profileName || 'default')
    );
  }

  persistentProfileName(
    app: AndroidApplication,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const profileMode = query.profileMode ?? app.profileMode;
    if (profileMode !== ApplicationProfileMode.Persistent) {
      return null;
    }

    return query.profileName?.trim() || app.profileName || 'default';
  }

  shellQuote(value: string) {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }
}
