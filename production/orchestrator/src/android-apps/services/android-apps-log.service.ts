import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { getErrorMessage } from '../../common/error-message';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../android-application-status';

type RuntimeLogPatch = Partial<{
  status: AndroidApplicationStatus;
  lifecycleStage: AndroidApplicationLifecycleStage;
  statusMessage: string | null;
  lastError: string | null;
}>;

@Injectable()
export class AndroidAppsLogService {
  private readonly logDir: string;

  constructor(private readonly config: ConfigService) {
    this.logDir = this.config.getOrThrow<string>('app.runtimeLogsDir');
  }

  async append(applicationId: string, message: string, context?: unknown) {
    const line = this.formatLine(message, context);
    await mkdir(this.logDir, { recursive: true });
    await appendFile(this.logPath(applicationId), `${line}\n`, 'utf-8');
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

  async remove(applicationId: string) {
    await rm(this.logPath(applicationId), { force: true });
  }

  private logPath(applicationId: string) {
    return join(
      this.logDir,
      `${applicationId.replace(/[^a-zA-Z0-9_-]/g, '_')}.log`,
    );
  }

  private formatLine(message: string, context?: unknown) {
    const payload =
      context === undefined
        ? ''
        : ` ${JSON.stringify(context, (_key, value) =>
            value === undefined ? undefined : value,
          )}`;

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

  private clampTail(tail: number) {
    if (!Number.isFinite(tail)) {
      return 300;
    }

    return Math.max(1, Math.min(Math.trunc(tail), 2000));
  }
}
