import { constants } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir, readdir, open, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { getErrorMessage } from '../../../common/error-message';
import type { AndroidAppsRuntimeLogMaintenancePort } from '../../contracts/android-apps-runtime-log-maintenance.port';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';

import {
  applicationLogMaxBytes,
  normalizeApplicationLogTail,
} from '../utils/application-log-tail';

type RuntimeLogPatch = Partial<{
  status: AndroidApplicationStatus;
  lifecycleStage: AndroidApplicationLifecycleStage;
  statusMessage: string | null;
  lastError: string | null;
}>;

@Injectable()
export class AndroidAppsLogService implements AndroidAppsRuntimeLogMaintenancePort {
  private readonly logger = new Logger(AndroidAppsLogService.name);
  private readonly logDir: string;

  constructor(config: ConfigService) {
    this.logDir = config.getOrThrow<string>('app.runtimeLogsDir');
  }

  async append(applicationId: string, message: string, context?: unknown) {
    try {
      const line = this.formatLine(message, context);
      await mkdir(this.logDir, { recursive: true });
      await appendFile(this.logPath(applicationId), `${line}\n`, 'utf-8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code ?? 'unknown';
      this.logger.warn(
        `Could not write app lifecycle log for ${applicationId} (${code}).`,
      );
    }
  }

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

  async read(applicationId: string, tail = 300) {
    try {
      const lineLimit = normalizeApplicationLogTail(tail);
      await using file = await open(
        this.logPath(applicationId),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      const stats = await file.stat();
      if (!stats.isFile()) return 'Application event log is unavailable.';
      const notice = '[Older log output omitted by the byte limit.]';
      const clipped = stats.size > applicationLogMaxBytes;
      const start = clipped
        ? stats.size - applicationLogMaxBytes + Buffer.byteLength(notice)
        : 0;
      const buffer = Buffer.alloc(stats.size - start);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, start);
      const firstBreak = clipped
        ? buffer.subarray(0, bytesRead).indexOf(0x0a)
        : -1;
      const firstLine = clipped && firstBreak < 0 ? bytesRead : firstBreak + 1;
      const lines = buffer
        .toString('utf-8', firstLine, bytesRead)
        .split('\n')
        .filter(Boolean);
      const output = lines.slice(-lineLimit).join('\n');
      if (clipped && lines.length < lineLimit) {
        return output ? `${notice}\n${output}` : notice;
      }
      return output;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return 'No orchestrator events have been recorded for this application yet.';
      }

      return `Could not read orchestrator event log: ${getErrorMessage(error)}`;
    }
  }

  async remove(applicationId: string) {
    await rm(this.logPath(applicationId), { force: true });
  }

  async cleanup(retentionDays = 30) {
    await mkdir(this.logDir, { recursive: true });
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let removedFiles = 0;

    for (const name of await readdir(this.logDir)) {
      if (!name.endsWith('.log')) {
        continue;
      }

      const path = join(this.logDir, name);
      const stats = await lstat(path).catch(() => null);
      if (!stats?.isFile() || stats.mtimeMs > cutoff) {
        continue;
      }

      await rm(path, { force: true });
      removedFiles += 1;
    }

    return { removedFiles };
  }

  private logPath(applicationId: string) {
    return join(
      this.logDir,
      `${applicationId.replace(/[^a-zA-Z0-9_-]/g, '_')}.log`,
    );
  }

  private formatLine(message: string, context?: unknown) {
    const payload = context === undefined ? '' : ` ${JSON.stringify(context)}`;

    return `${new Date().toISOString()} ${message}${payload}`;
  }

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
}
