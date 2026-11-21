import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { DataSource } from 'typeorm';
import { InitializeSqliteSchema1800000005000 } from '../../database/migrations/1800000005000-initialize-sqlite-schema';
import { ApkBlockRule } from '../entities/apk-block-rule.entity';
import { UploadedApk } from '../entities/uploaded-apk.entity';
import { ApkBlockRulesRepository } from '../persistence/apk-block-rules.repository';
import { UploadedApksRepository } from '../persistence/uploaded-apks.repository';
import { ApkBlockPolicyService } from './apk-block-policy.service';
import { ApkLibraryService } from './apk-library.service';
import { ApkStorageService } from './apk-storage.service';

describe('APK library', () => {
  let dataSource: DataSource;
  let directory: string;
  let uploads: UploadedApksRepository;
  let storage: ApkStorageService;
  let policy: ApkBlockPolicyService;
  let library: ApkLibraryService;
  let attachedId: string | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-apk-library-'));
    dataSource = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      migrations: [InitializeSqliteSchema1800000005000],
      migrationsRun: true,
      entities: [UploadedApk, ApkBlockRule],
    }).initialize();
    uploads = new UploadedApksRepository(dataSource.getRepository(UploadedApk));
    const rules = new ApkBlockRulesRepository(
      dataSource.getRepository(ApkBlockRule),
    );
    storage = new ApkStorageService(
      uploads,
      new ConfigService({ app: { uploadsDir: directory } }),
    );
    policy = new ApkBlockPolicyService(rules);
    attachedId = undefined;
    library = new ApkLibraryService(uploads, rules, storage, {
      countUsingUploadedApk: async (id) => (id === attachedId ? 1 : 0),
      findReferencedUploadedApkIds: async (ids) =>
        new Set(ids.filter((id) => id === attachedId)),
      listUploadedApkReferences: async () =>
        attachedId
          ? [{ id: 'app', name: 'Warehouse QA', uploadedApkId: attachedId }]
          : [],
    });
  });

  afterEach(async () => {
    await dataSource.destroy();
    await rm(directory, { recursive: true, force: true });
  });

  const save = async (
    name: string,
    owner: string,
    packageName = 'com.example.stockroom',
  ) => {
    const content = Buffer.from(name);
    const upload = await storage.withPersistedApk(
      Readable.from([content]),
      content.length,
      (stored) =>
        uploads.save(
          uploads.create({
            originalName: `${name}.apk`,
            ownerUserId: owner,
            packageName,
            ...stored,
          }),
        ),
    );
    return { upload, id: `sha256:${upload.sha256}` };
  };

  it('distinguishes exact and package blocks and retains rules after deleting shared bytes', async () => {
    const first = await save('build-1', 'owner');
    await save('build-1', 'another-owner');
    const second = await save('build-2', 'owner');
    expect(await library.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, uploads: 2 }),
      ]),
    );
    await library.mutate({
      action: 'block',
      scope: 'sha256',
      ids: [first.id],
      reason: 'Withdrawn build',
    });
    await expect(
      policy.assertAllowed(first.upload.sha256, first.upload.packageName),
    ).rejects.toThrow('blocked');
    await expect(
      policy.assertAllowed(second.upload.sha256, second.upload.packageName),
    ).resolves.toBeUndefined();
    await library.mutate({
      action: 'block',
      scope: 'package',
      ids: [first.id, second.id],
      reason: 'Withdrawn package',
    });
    await expect(
      policy.assertAllowed(second.upload.sha256, second.upload.packageName),
    ).rejects.toThrow('blocked');
    await expect(
      policy.assertAllowed(second.upload.sha256, null),
    ).rejects.toThrow('verify');

    attachedId = second.upload.id;
    const deleted = await library.mutate({
      action: 'delete',
      ids: [first.id, second.id],
    });
    expect(deleted).toMatchObject({
      changed: [first.id],
      skipped: [{ id: second.id }],
      bytesFreed: first.upload.sizeBytes,
    });
    await expect(readFile(first.upload.filePath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await library.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.id,
          sizeBytes: null,
          rules: expect.arrayContaining([
            expect.objectContaining({ scope: 'sha256' }),
            expect.objectContaining({ scope: 'package' }),
          ]),
        }),
      ]),
    );
    await library.mutate({
      action: 'unblock',
      scope: 'package',
      ids: [second.id],
    });
    await expect(
      policy.assertAllowed(first.upload.sha256, first.upload.packageName),
    ).rejects.toThrow('blocked');
    await expect(
      policy.assertAllowed(second.upload.sha256, second.upload.packageName),
    ).resolves.toBeUndefined();
    await library.mutate({
      action: 'unblock',
      scope: 'sha256',
      ids: [first.id],
    });
    expect((await library.list()).map((entry) => entry.id)).toEqual([
      second.id,
    ]);
  });

  it('retains the records and shared bytes when the catalog delete fails', async () => {
    const { id, upload } = await save('build-kept', 'owner');
    jest
      .spyOn(uploads, 'removeBySha256')
      .mockRejectedValueOnce(new Error('database offline'));

    await expect(
      library.mutate({ action: 'delete', ids: [id] }),
    ).resolves.toMatchObject({
      changed: [],
      skipped: [{ id }],
      bytesFreed: 0,
    });
    await expect(uploads.findBySha256(upload.sha256)).resolves.toHaveLength(1);
    await expect(readFile(upload.filePath, 'utf8')).resolves.toBe('build-kept');
  });

  it('leaves committed removals eligible for a later orphan cleanup', async () => {
    const { id, upload } = await save('build-orphaned', 'owner');
    jest
      .spyOn(storage, 'removeSharedFileIfUnreferenced')
      .mockResolvedValueOnce(false);

    await expect(
      library.mutate({ action: 'delete', ids: [id] }),
    ).resolves.toMatchObject({
      changed: [id],
      bytesFreed: 0,
    });
    await expect(uploads.findBySha256(upload.sha256)).resolves.toEqual([]);
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await utimes(upload.filePath, old, old);
    await expect(storage.cleanupOrphanedFiles()).resolves.toBe(1);
    await expect(readFile(upload.filePath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
