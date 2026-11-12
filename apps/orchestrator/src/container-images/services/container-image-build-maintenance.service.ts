import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { lstat, opendir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContainerImageBuildMaintenancePort } from '../contracts/container-image-build-maintenance.port';
import {
  gappsTemporaryPackageDirectory,
  gappsWorkDirectory,
} from '../utils/gapps-staging-paths';
import { ContainerImageBuildJobService } from './container-image-build-job.service';
import { ContainerImageBuilderService } from './container-image-builder.service';
import { ContainerImageGappsBuilderService } from './container-image-gapps-builder.service';

const stagingGracePeriodMs = 24 * 60 * 60 * 1000;

const ignoreMissing = (error: unknown) => {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  return null;
};

@Injectable()
export class ContainerImageBuildMaintenanceService implements ContainerImageBuildMaintenancePort {
  private readonly logger = new Logger(
    ContainerImageBuildMaintenanceService.name,
  );

  constructor(
    private readonly config: ConfigService,
    private readonly jobs: ContainerImageBuildJobService,
    private readonly builds: ContainerImageBuilderService,
    private readonly gappsBuilds: ContainerImageGappsBuilderService,
  ) {}

  async cleanInterruptedBuilds() {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    const cutoff = Date.now() - stagingGracePeriodMs;
    const packages = await this.sweep(
      gappsTemporaryPackageDirectory(uploadsDir),
      'package',
      cutoff,
    );
    const workDirectories = await this.sweep(
      gappsWorkDirectory(uploadsDir),
      'work',
      cutoff,
    );
    this.logger.log(
      `Removed ${packages} temporary GApps packages and ${workDirectories} GApps work directories.`,
    );
  }

  async pruneBuildHistory(cutoff: Date) {
    const removed = await this.jobs.pruneHistory(cutoff, [
      ...this.builds.activeBuildIds(),
      ...this.gappsBuilds.activeBuildIds(),
    ]);
    this.logger.log(`Removed ${removed} completed image build records.`);
  }

  private async sweep(
    directory: string,
    kind: 'package' | 'work',
    cutoff: number,
  ) {
    const root = await lstat(directory).catch(ignoreMissing);
    if (!root?.isDirectory()) return 0;

    const entries = await opendir(directory).catch(ignoreMissing);
    if (!entries) return 0;

    let removed = 0;
    for await (const entry of entries) {
      if (kind === 'package' && !entry.name.endsWith('.zip')) continue;
      const jobId = kind === 'package' ? entry.name.slice(0, -4) : entry.name;
      if (!isUUID(jobId, '4')) continue;

      const path = join(directory, entry.name);
      const stats = await lstat(path).catch(ignoreMissing);
      const expectedType =
        kind === 'package' ? stats?.isFile() : stats?.isDirectory();
      if (!stats || !expectedType || stats.mtimeMs >= cutoff) continue;
      if (await this.jobs.hasUnfinishedGappsJob(jobId)) continue;
      // Cancellation can terminalize a row before the builder releases its files.
      if (this.gappsBuilds.activeBuildIds().includes(jobId)) continue;

      const deleted = await rm(path, { recursive: kind === 'work' })
        .then(() => true)
        .catch(ignoreMissing);
      if (deleted) removed += 1;
    }
    return removed;
  }
}
