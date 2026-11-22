import type { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContainerImageGappsCacheService } from './container-image-gapps-cache.service';

describe('ContainerImageGappsCacheService', () => {
  let uploadsDir: string;
  let service: ContainerImageGappsCacheService;

  beforeEach(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'rebroid-gapps-cache-'));
    service = new ContainerImageGappsCacheService({
      getOrThrow: () => uploadsDir,
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(uploadsDir, { recursive: true, force: true });
  });

  const sha256 = (contents: string) =>
    createHash('sha256').update(contents).digest('hex');

  it('promotes and verifies revision-addressed package caches', async () => {
    const temporary = await service.createTemporaryPath('job-1');
    await writeFile(temporary, 'verified-package');
    const promoted = await service.promote(
      temporary,
      '14',
      'a'.repeat(40),
      sha256('verified-package'),
    );

    await expect(service.findVerified('14', 'a'.repeat(40))).resolves.toEqual(
      promoted,
    );
    await expect(readFile(promoted.packagePath, 'utf8')).resolves.toBe(
      'verified-package',
    );
  });

  it('rejects a cache whose package no longer matches its SHA-256', async () => {
    const revision = 'b'.repeat(40);
    const temporary = await service.createTemporaryPath('job-2');
    await writeFile(temporary, 'original');
    const promoted = await service.promote(
      temporary,
      '13',
      revision,
      sha256('original'),
    );
    await writeFile(promoted.packagePath, 'tampered');

    await expect(service.findVerified('13', revision)).resolves.toBeNull();
  });

  it('keeps a verified revision when a replacement changes before promotion', async () => {
    const revision = 'a'.repeat(40);
    const path = await service.createTemporaryPath('job');
    await writeFile(path, 'original');
    const original = await service.promote(
      path,
      '14',
      revision,
      sha256('original'),
    );
    await writeFile(path, 'changed');

    await expect(
      service.promote(path, '14', revision, sha256('expected')),
    ).rejects.toThrow('GApps package changed during validation');
    await expect(service.findVerified('14', revision)).resolves.toEqual(
      original,
    );
  });

  it('keeps the verified revision when verification or promotion is cancelled', async () => {
    const revision = 'a'.repeat(40);
    const path = await service.createTemporaryPath('job');
    await writeFile(path, 'original');
    const original = await service.promote(
      path,
      '14',
      revision,
      sha256('original'),
    );
    await writeFile(path, 'replacement');
    const reason = new Error('build cancelled');
    await expect(
      service.findVerified('14', revision, AbortSignal.abort(reason)),
    ).rejects.toBe(reason);
    const controller = new AbortController();
    jest.spyOn(service, 'calculateSha256').mockImplementationOnce(async () => {
      controller.abort(reason);
      return sha256('replacement');
    });
    await expect(
      service.promote(
        path,
        '14',
        revision,
        sha256('replacement'),
        controller.signal,
      ),
    ).rejects.toBe(reason);
    await expect(service.findVerified('14', revision)).resolves.toEqual(
      original,
    );
    await expect(readFile(path, 'utf8')).resolves.toBe('replacement');
  });

  it('keeps a verified revision if moving its replacement fails', async () => {
    const revision = 'b'.repeat(40);
    const path = await service.createTemporaryPath('job');
    await writeFile(path, 'original');
    const original = await service.promote(
      path,
      '14',
      revision,
      sha256('original'),
    );
    jest
      .spyOn(service, 'calculateSha256')
      .mockResolvedValueOnce(sha256('replacement'));

    await expect(
      service.promote(path, '14', revision, sha256('replacement')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(service.findVerified('14', revision)).resolves.toEqual(
      original,
    );
  });

  it.each(['15', '16'] as const)(
    'rebuilds previously cached Android %s packages with the compatible Framework',
    async (androidVersion) => {
      const revision = 'c'.repeat(40);
      const directory = join(
        uploadsDir,
        'image-build-gapps-cache',
        androidVersion,
      );
      const oldPackage = 'package with incompatible Framework';
      const oldChecksum = sha256(oldPackage);
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
        sha256('package with compatible Framework'),
      );
      await service.retainOnly(androidVersion, revision);
      await expect(
        service.findVerified(androidVersion, revision),
      ).resolves.toEqual(promoted);
      await expect(
        readFile(join(directory, `${revision}.zip`)),
      ).rejects.toHaveProperty('code', 'ENOENT');
    },
  );
});
