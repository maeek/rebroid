import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
} from 'node:fs/promises';
import { join } from 'node:path';
import { getErrorMessage } from '../../../common/error-message';
import type { AndroidAppsRuntimeLogMaintenancePort } from '../../contracts/android-apps-runtime-log-maintenance.port';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';

type RuntimeLogPatch = Partial<{
  status: AndroidApplicationStatus;
  lifecycleStage: AndroidApplicationLifecycleStage;
  statusMessage: string | null;
  lastError: string | null;
}>;

@Injectable()
export class AndroidAppsLogService implements AndroidAppsRuntimeLogMaintenancePort {
  private readonly logDir: string;

  constructor(private readonly config: ConfigService) {
    this.logDir = this.config.getOrThrow<string>('app.runtimeLogsDir');
  }

  /** Writes one event line to the app log file. */
  async append(applicationId: string, message: string, context?: unknown) {
    const line = this.formatLine(message, context);
    await mkdir(this.logDir, { recursive: true });
    await appendFile(this.logPath(applicationId), `${line}\n`, 'utf-8');
  }

  /** Writes lifecycle changes to the app log file. */
  async appendLifecycle(applicationId: string, patch: RuntimeLogPatch) {
    const shouldLog =
      patch.status !== undefined ||
      patch.lifecycleStage !== undefined ||
      patch.lastError !== undefined;

    if (!shouldLog) {
      return;
    }

    const context = {
      status: patch.status,
      lifecycleStage: patch.lifecycleStage,
      message: patch.statusMessage,
      error: patch.lastError,
    };

    await this.append(applicationId, this.lifecycleMessage(patch), context);
  }

  /** Reads the latest lines from the app log file. */
  async read(applicationId: string, tail = 300) {
    try {
      const content = await readFile(this.logPath(applicationId), 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      return lines.slice(-this.clampTail(tail)).join('\n');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return 'No orchestrator events have been recorded for this application yet.';
      }

      return `Could not read orchestrator event log: ${getErrorMessage(error)}`;
    }
  }

  /** Deletes the app log file. */
  async remove(applicationId: string) {
    await rm(this.logPath(applicationId), { force: true });
  }

  /** Removes runtime log files older than the requested retention period. */
  async cleanup(retentionDays = 30) {
    await mkdir(this.logDir, { recursive: true });
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let removedFiles = 0;

    for (const name of await readdir(this.logDir)) {
      if (!name.endsWith('.log')) {
        continue;
      }

      const path = join(this.logDir, name);
      const stats = await stat(path).catch(() => null);
      if (!stats || stats.mtimeMs > cutoff) {
        continue;
      }

      await rm(path, { force: true });
      removedFiles += 1;
    }

    return { removedFiles };
  }

  /** Builds the log file path for one app. */
  private logPath(applicationId: string) {
    return join(
      this.logDir,
      `${applicationId.replace(/[^a-zA-Z0-9_-]/g, '_')}.log`,
    );
  }

  /** Turns one log event into a text line. */
  private formatLine(message: string, context?: unknown) {
    const payload =
      context === undefined
        ? ''
        : ` ${JSON.stringify(context, (_key, value) =>
            value === undefined ? undefined : value,
          )}`;

    return `${new Date().toISOString()} ${message}${payload}`;
  }

  /** Picks the log message for a lifecycle update. */
  private lifecycleMessage(patch: RuntimeLogPatch) {
    if (patch.lastError) {
      return 'Lifecycle failed';
    }

    if (patch.lifecycleStage) {
      return `Lifecycle stage: ${patch.lifecycleStage}`;
    }

    if (patch.status) {
      return `Status changed: ${patch.status}`;
    }

    return 'Lifecycle updated';
  }

  /** Keeps the requested tail size in a safe range. */
  private clampTail(tail: number) {
    if (!Number.isFinite(tail)) {
      return 300;
    }

    return Math.max(1, Math.min(Math.trunc(tail), 2000));
  }
}
