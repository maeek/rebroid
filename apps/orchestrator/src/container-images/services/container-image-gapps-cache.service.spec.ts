import type { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContainerImageGappsCacheService } from './container-image-gapps-cache.service';

describe('ContainerImageGappsCacheService', () => {
  it('promotes and verifies revision-addressed package caches', async () => {
    const uploadsDir = await mkdtemp(join(tmpdir(), 'rebroid-gapps-cache-'));
    const config = {
      getOrThrow: jest.fn().mockReturnValue(uploadsDir),
    } as unknown as ConfigService;
    const service = new ContainerImageGappsCacheService(config);
    try {
      const temporary = await service.createTemporaryPath('job-1');
      await writeFile(temporary, 'verified-package');
      const promoted = await service.promote(temporary, '14', 'a'.repeat(40));

      await expect(service.findVerified('14', 'a'.repeat(40))).resolves.toEqual(
        promoted,
      );
      await expect(readFile(promoted.packagePath, 'utf8')).resolves.toBe(
        'verified-package',
      );
    } finally {
      await rm(uploadsDir, { recursive: true, force: true });
    }
  });

  it('rejects a cache whose package no longer matches its SHA-256', async () => {
    const uploadsDir = await mkdtemp(join(tmpdir(), 'rebroid-gapps-cache-'));
    const config = {
      getOrThrow: jest.fn().mockReturnValue(uploadsDir),
    } as unknown as ConfigService;
    const service = new ContainerImageGappsCacheService(config);
    try {
      const revision = 'b'.repeat(40);
      const temporary = await service.createTemporaryPath('job-2');
      await writeFile(temporary, 'original');
      const promoted = await service.promote(temporary, '13', revision);
      await writeFile(promoted.packagePath, 'tampered');

      await expect(service.findVerified('13', revision)).resolves.toBeNull();
    } finally {
      await rm(uploadsDir, { recursive: true, force: true });
    }
  });

  it.each(['15', '16'] as const)(
    'rebuilds previously cached Android %s packages with the compatible Framework',
    async (androidVersion) => {
      const uploadsDir = await mkdtemp(join(tmpdir(), 'rebroid-gapps-cache-'));
      const config = {
        getOrThrow: jest.fn().mockReturnValue(uploadsDir),
      } as unknown as ConfigService;
      const service = new ContainerImageGappsCacheService(config);
      try {
        const revision = 'c'.repeat(40);
        const directory = join(
          uploadsDir,
          'image-build-gapps-cache',
          androidVersion,
        );
        const oldPackage = 'package with incompatible Framework';
        const oldChecksum = createHash('sha256')
          .update(oldPackage)
          .digest('hex');
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, `${revision}.zip`), oldPackage);
        await writeFile(join(directory, `${revision}.sha256`), oldChecksum);

        await expect(
          service.findVerified(androidVersion, revision),
        ).resolves.toBeNull();

        const temporary = await service.createTemporaryPath('job-3');
        await writeFile(temporary, 'package with compatible Framework');
        const promoted = await service.promote(
          temporary,
          androidVersion,
          revision,
        );
        await service.retainOnly(androidVersion, revision);
        await expect(
          service.findVerified(androidVersion, revision),
        ).resolves.toEqual(promoted);
        await expect(
          readFile(join(directory, `${revision}.zip`)),
        ).rejects.toHaveProperty('code', 'ENOENT');
      } finally {
        await rm(uploadsDir, { recursive: true, force: true });
      }
    },
  );
});
