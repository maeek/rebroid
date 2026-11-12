import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  gappsTemporaryPackageDirectory,
  gappsWorkDirectory,
} from '../utils/gapps-staging-paths';
import type { ContainerImageBuildJobService } from './container-image-build-job.service';
import { ContainerImageBuildMaintenanceService } from './container-image-build-maintenance.service';
import type { ContainerImageBuilderService } from './container-image-builder.service';
import type { ContainerImageGappsBuilderService } from './container-image-gapps-builder.service';

describe('ContainerImageBuildMaintenanceService', () => {
  it('removes stale staging for finished or missing jobs and protects live, fresh, and unmanaged paths', async () => {
    const uploadsDir = await mkdtemp(
      join(tmpdir(), 'rebroid-image-maintenance-'),
    );
    const packageDirectory = gappsTemporaryPackageDirectory(uploadsDir);
    const workDirectory = gappsWorkDirectory(uploadsDir);
    const verifiedDirectory = join(packageDirectory, '..', '14');
    const stale = new Date(Date.now() - 2 * 86_400_000);
    const [finished, missing, running, queued, cancelling, fresh, link] =
      Array.from({ length: 7 }, randomUUID);
    const jobs = {
      hasUnfinishedGappsJob: async (id: string) =>
        id === running || id === queued,
    } as ContainerImageBuildJobService;
    const gappsBuilds = {
      activeBuildIds: () => [cancelling],
    } as ContainerImageGappsBuilderService;
    const service = new ContainerImageBuildMaintenanceService(
      new ConfigService({ app: { uploadsDir } }),
      jobs,
      {} as ContainerImageBuilderService,
      gappsBuilds,
    );

    try {
      await service.cleanInterruptedBuilds();
      await mkdir(packageDirectory, { recursive: true });
      await mkdir(verifiedDirectory, { recursive: true });
      await writeFile(join(verifiedDirectory, 'verified.zip'), 'cache');

      for (const id of [
        finished,
        missing,
        running,
        queued,
        cancelling,
        fresh,
        'other',
      ]) {
        const temporaryPackage = join(packageDirectory, `${id}.zip`);
        const work = join(workDirectory, id);
        await writeFile(temporaryPackage, 'staged');
        await mkdir(work, { recursive: true });
        await writeFile(join(work, 'file'), 'extracted');
        if (id === fresh) continue;
        await utimes(temporaryPackage, stale, stale);
        await utimes(work, stale, stale);
      }
      await symlink(verifiedDirectory, join(workDirectory, link));

      await service.cleanInterruptedBuilds();
      await service.cleanInterruptedBuilds();

      const kept = [running, queued, cancelling, fresh, 'other'];
      expect((await readdir(packageDirectory)).sort()).toEqual(
        kept.map((id) => `${id}.zip`).sort(),
      );
      expect((await readdir(workDirectory)).sort()).toEqual(
        [...kept, link].sort(),
      );
      expect(await readdir(verifiedDirectory)).toEqual(['verified.zip']);
    } finally {
      await rm(uploadsDir, { recursive: true, force: true });
    }
  });
});
