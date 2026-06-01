import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { ApkStorageService } from './apk-storage.service';

describe('ApkStorageService', () => {
  let directory: string;
  let storage: ApkStorageService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-apk-storage-'));
    storage = new ApkStorageService(
      {
        countBy: jest.fn().mockResolvedValue(0),
        find: jest.fn().mockResolvedValue([]),
      } as never,
      {
        getOrThrow: () => directory,
      } as unknown as ConfigService,
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('streams an APK into content-addressed storage', async () => {
    const content = Buffer.from('apk-content');
    const persisted = await storage.persistApkStream(
      Readable.from([content.subarray(0, 3), content.subarray(3)]),
      1024,
    );

    expect(persisted.sha256).toBe(
      createHash('sha256').update(content).digest('hex'),
    );
    await expect(readFile(persisted.filePath)).resolves.toEqual(content);
  });

  it('removes temporary files when a stream exceeds its limit', async () => {
    await expect(
      storage.persistApkStream(Readable.from([Buffer.alloc(16)]), 8),
    ).rejects.toThrow('configured size limit');

    await expect(readdir(join(directory, 'apks'))).resolves.toEqual([]);
  });
});
