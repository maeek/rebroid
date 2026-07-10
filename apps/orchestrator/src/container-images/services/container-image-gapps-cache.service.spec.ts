import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
});
