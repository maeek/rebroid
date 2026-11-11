import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { MultipartUploadRequest } from '../../common/http-upload';
import type { UploadedApk } from '../entities/uploaded-apk.entity';
import { ApkCatalogService } from './apk-catalog.service';
import { ApkStorageService } from './apk-storage.service';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const uploadRequest = () => {
  const request = Readable.from([
    '--boundary\r\nContent-Disposition: form-data; name="apk"; filename="app.apk"\r\nContent-Type: application/octet-stream\r\n\r\napk-content\r\n--boundary--\r\n',
  ]) as MultipartUploadRequest;
  request.headers = {
    'content-type': 'multipart/form-data; boundary=boundary',
  };
  return request;
};

describe('APK catalog shared blob coordination', () => {
  let directory: string;
  let records: UploadedApk[];
  let storage: ApkStorageService;
  let service: ApkCatalogService;
  let analyze: jest.Mock;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-apk-catalog-'));
    records = [];
    let nextId = 0;
    const repository = {
      create: (values: Partial<UploadedApk>) => ({
        ...values,
        id: `apk-${++nextId}`,
      }),
      save: async (record: UploadedApk) => {
        records = records.filter((current) => current.id !== record.id);
        records.push(record);
        return record;
      },
      findById: async (id: string) =>
        records.find((record) => record.id === id),
      findBySha256ForOwner: async (sha256: string, ownerUserId: string) =>
        records.find(
          (record) =>
            record.sha256 === sha256 && record.ownerUserId === ownerUserId,
        ),
      countBySha256: async (sha256: string) =>
        records.filter((record) => record.sha256 === sha256).length,
      remove: async (record: UploadedApk) => {
        records = records.filter((current) => current.id !== record.id);
      },
      listForCleanup: async () => [...records],
      referencedFileNames: async () =>
        new Set(records.map(({ sha256 }) => `${sha256}.apk`)),
    };
    storage = new ApkStorageService(
      repository as never,
      {
        getOrThrow: () => directory,
      } as unknown as ConfigService,
    );
    analyze = jest.fn().mockResolvedValue({ packageName: 'com.example.app' });
    service = new ApkCatalogService(
      repository as never,
      { countUsingUploadedApk: async () => 0 } as never,
      { getMaxApkUploadBytes: async () => 1024 } as never,
      storage,
      { extractMetadataFromFile: analyze } as never,
      {
        analyze: async () => ({
          verdict: 'unknown',
          evidence: [],
          analysisVersion: 1,
        }),
      } as never,
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('deduplicates concurrent owner uploads after publication and analysis', async () => {
    const entered = deferred();
    const release = deferred();
    analyze.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
      return { packageName: 'com.example.app' };
    });
    const first = service.upload(uploadRequest(), 'owner');
    await entered.promise;
    const queued = deferred();
    const withHash = storage.withHash.bind(storage);
    jest
      .spyOn(storage, 'withHash')
      .mockImplementationOnce((sha256, operation) => {
        queued.resolve();
        return withHash(sha256, operation);
      });
    const second = service.upload(uploadRequest(), 'owner');
    await queued.promise;
    expect(analyze).toHaveBeenCalledTimes(1);
    release.resolve();
    const results = await Promise.all([first, second]);
    expect(results[0].id).toBe(results[1].id);
    expect(records).toHaveLength(1);
    await expect(readFile(results[0].filePath)).resolves.toEqual(
      Buffer.from('apk-content'),
    );
  });

  it('serializes owner clones without duplicating records', async () => {
    const source = await service.upload(uploadRequest(), 'source-owner');
    const results = await Promise.all([
      service.cloneForOwner(source.id, 'new-owner'),
      service.cloneForOwner(source.id, 'new-owner'),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(records).toHaveLength(2);
  });

  it('keeps a reused old blob through upload, deletion, and orphan cleanup', async () => {
    const source = await service.upload(uploadRequest(), 'source-owner');
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await utimes(source.filePath, old, old);
    const entered = deferred();
    const release = deferred();
    analyze.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
      return { packageName: 'com.example.app' };
    });
    const uploading = service.upload(uploadRequest(), 'new-owner');
    await entered.promise;
    const deleting = service.remove(source.id);
    const cleaning = storage.cleanupOrphanedFiles();
    release.resolve();
    const [created] = await Promise.all([uploading, deleting, cleaning]);
    expect(records.map((record) => record.id)).toEqual([created.id]);
    await expect(readFile(created.filePath)).resolves.toEqual(
      Buffer.from('apk-content'),
    );
  });

  it('rechecks orphan candidates after an in-flight upload commits', async () => {
    const orphan = await storage.persistApkStream(
      Readable.from([Buffer.from('apk-content')]),
      1024,
    );
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await utimes(orphan.filePath, old, old);
    const entered = deferred();
    const release = deferred();
    analyze.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
      return { packageName: 'com.example.app' };
    });
    const uploading = service.upload(uploadRequest(), 'owner');
    await entered.promise;
    const queued = deferred();
    const withHash = storage.withHash.bind(storage);
    jest
      .spyOn(storage, 'withHash')
      .mockImplementationOnce((sha256, operation) => {
        queued.resolve();
        return withHash(sha256, operation);
      });
    const cleanup = storage.cleanupOrphanedFiles();
    await queued.promise;
    release.resolve();
    await expect(cleanup).resolves.toBe(0);
    await expect(uploading).resolves.toHaveProperty(
      'filePath',
      orphan.filePath,
    );
    await expect(readFile(orphan.filePath)).resolves.toEqual(
      Buffer.from('apk-content'),
    );
  });

  it('allows the next upload to republish after an analysis failure', async () => {
    const entered = deferred();
    const release = deferred();
    analyze.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
      throw new Error('analysis failed');
    });
    const failed = service.upload(uploadRequest(), 'owner');
    await entered.promise;
    const retried = service.upload(uploadRequest(), 'owner');
    release.resolve();
    const results = await Promise.allSettled([failed, retried]);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
    expect(records).toHaveLength(1);
    await expect(readFile(records[0].filePath)).resolves.toEqual(
      Buffer.from('apk-content'),
    );
  });
});
