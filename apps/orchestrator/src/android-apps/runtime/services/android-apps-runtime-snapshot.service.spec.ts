import { ConfigService } from '@nestjs/config';
import fs from 'node:fs/promises';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsRuntimeOperationGate } from '../../common/services/android-apps-runtime-operation-gate.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { snapshotRuntimeKey } from '../../common/utils/android-runtime-identity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { AndroidAppRuntimeSnapshotsRepository } from '../../persistence/android-app-runtime-snapshots.repository';
import { AndroidAppsRuntimeSnapshotService } from './android-apps-runtime-snapshot.service';

describe('runtime snapshots', () => {
  const app = Object.assign(new AndroidApplication(), {
    id: '9f81291b-f0b8-441d-b98b-8ab97f559e6a',
    ownerUserId: 'owner',
    status: AndroidApplicationStatus.Running,
    containerId: 'runtime',
    lastStartedAt: new Date('2026-11-13T10:00:00Z'),
    profileMode: ApplicationProfileMode.Persistent,
    profileName: null,
    containerName: 'runtime-name',
    networkName: 'app-network',
    adbPort: 5555,
  });
  const initialStart = '2026-11-13T10:00:00.000000001Z';
  const captureTime = '2026-11-13T10:01:00.000Z';
  let directory: string;
  let snapshotDir: string;
  let stored: AndroidApplication;
  let containerStartedAt: string;
  let running: boolean;
  let repository: AndroidAppRuntimeSnapshotsRepository;
  let service: AndroidAppsRuntimeSnapshotService;
  const captureSnapshotPng = jest.fn();
  const inspectContainer = jest.fn();

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-snapshot-'));
    snapshotDir = join(directory, 'runtime-snapshots');
    stored = { ...app };
    running = true;
    containerStartedAt = initialStart;
    repository = new AndroidAppRuntimeSnapshotsRepository(
      new ConfigService({ app: { runtimeSnapshotsDir: snapshotDir } }),
      { findById: async () => stored } as never,
    );
    const queries = {
      getStored: jest.fn(async () => stored),
      listOwnedRunningSnapshotTargets: async () => [stored],
    };
    inspectContainer.mockReset().mockImplementation(async () => ({
      Id: app.containerId,
      State: { Running: running, StartedAt: containerStartedAt },
      Config: {
        Labels: {
          'com.rebroid.managed': 'true',
          'com.rebroid.component': 'runtime',
          'com.rebroid.application-id': app.id,
        },
      },
      NetworkSettings: {
        Networks: { [app.networkName]: { IPAddress: '172.20.0.2' } },
      },
    }));
    const png = await sharp({
      create: { width: 540, height: 1080, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    captureSnapshotPng.mockReset().mockResolvedValue({
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      capturedAt: captureTime,
    });
    const containers = { inspectContainer };
    service = new AndroidAppsRuntimeSnapshotService(
      queries as never,
      new AndroidAppsRuntimeOperationGate(
        queries as never,
        containers as never,
      ),
      repository,
      { captureSnapshotPng } as never,
      { isDockerNotFound: () => false } as never,
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('prioritizes authorized preview demand and stops admitting capture work at the sweep deadline', async () => {
    jest.useFakeTimers();
    const timeout = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation((ms) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
      });
    const candidates = Array.from({ length: 7 }, (_, index) => ({
      ...app,
      id: String(index),
    }));
    const demanded = candidates[6];
    const requested: string[] = [];
    const captures: AndroidAppsRuntimeSnapshotService =
      new AndroidAppsRuntimeSnapshotService(
        {
          getStored: async (id: string) =>
            candidates.find((candidate) => candidate.id === id),
          listOwnedRunningSnapshotTargets: async () => candidates,
        } as never,
        {
          withCurrentRuntime: jest.fn(
            async (_runtime: unknown, signal: AbortSignal) => {
              if (signal.aborted) signal.throwIfAborted();
              await new Promise((resolve) => setTimeout(resolve, 46_000));
            },
          ),
        } as never,
        {
          read: jest.fn().mockResolvedValue(null),
          readMetadata: jest.fn((id: string) => {
            requested.push(id);
            return Promise.resolve(null);
          }),
        } as never,
        {} as never,
        { isDockerNotFound: () => false } as never,
      );
    try {
      await expect(
        captures.read(candidates[5].id, 'other'),
      ).rejects.toMatchObject({
        status: 404,
      });
      await expect(captures.read(demanded.id, 'owner')).rejects.toMatchObject({
        status: 404,
      });
      const first = captures.captureRunningApplications();
      expect(captures.captureRunningApplications()).toBe(first);
      await jest.advanceTimersByTimeAsync(46_000);
      await first;
      expect(requested).toEqual(['6', '0', '1', '2']);

      const second = captures.captureRunningApplications();
      await jest.advanceTimersByTimeAsync(46_000);
      await second;
      expect(requested.slice(4)).toEqual(['6', '3', '4', '5']);
    } finally {
      timeout.mockRestore();
      jest.useRealTimers();
    }
  });

  it('replaces the private file, downscales the image and checks the owner before reading', async () => {
    await service.captureRunningApplications();
    const newCaptureTime = '2026-11-13T10:02:00.000Z';
    const firstCapture = await captureSnapshotPng.mock.results[0].value;
    captureSnapshotPng.mockResolvedValue({
      ...firstCapture,
      capturedAt: newCaptureTime,
    });
    await service.captureRunningApplications();
    const files = await readdir(snapshotDir);
    expect(files).toEqual([`${app.id}.snapshot`]);
    expect((await stat(join(snapshotDir, files[0]))).mode & 0o777).toBe(0o600);
    expect((await stat(snapshotDir)).mode & 0o777).toBe(0o700);
    inspectContainer.mockClear();
    await expect(service.read(app.id, 'other')).rejects.toMatchObject({
      status: 404,
    });
    expect(inspectContainer).not.toHaveBeenCalled();
    const snapshot = await service.read(app.id, 'owner');
    expect(snapshot).toMatchObject({
      mimeType: 'image/webp',
      capturedAt: newCaptureTime,
    });
    const buffer = Buffer.from(snapshot.dataUrl.split(',')[1], 'base64');
    await expect(sharp(buffer).metadata()).resolves.toMatchObject({
      format: 'webp',
      width: 240,
      height: 480,
    });
  });

  it('rejects an image from an earlier start and cleans it up even if the next capture fails', async () => {
    await service.captureRunningApplications();
    containerStartedAt = '2026-11-13T10:02:00.000000001Z';
    await expect(service.read(app.id, 'owner')).rejects.toMatchObject({
      status: 404,
    });
    captureSnapshotPng.mockRejectedValue(new Error('ADB unavailable'));
    await service.captureRunningApplications();
    await expect(repository.read(app.id)).resolves.toBeNull();
  });

  it('reads a snapshot written with the original runtime key and rejects it after the owner changes', async () => {
    const originalMetadata = {
      runtimeKey:
        'c253ed35b1c5c46391096d139a087e86e7dd82eeda0922935e15c343a8376673',
      containerStartedAt: initialStart,
      capturedAt: captureTime,
    };
    await mkdir(snapshotDir, { mode: 0o700 });
    await writeFile(
      join(snapshotDir, `${app.id}.snapshot`),
      `${JSON.stringify(originalMetadata)}\nprevious snapshot`,
      { mode: 0o600 },
    );
    await expect(service.read(app.id, 'owner')).resolves.toMatchObject({
      capturedAt: captureTime,
    });
    stored = { ...stored, ownerUserId: 'new-owner' };
    await expect(service.read(app.id, 'owner')).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.read(app.id, 'new-owner')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('requires a managed runtime at the app address for capture and read', async () => {
    await service.captureRunningApplications();
    captureSnapshotPng.mockClear();
    const observed = await inspectContainer();
    inspectContainer.mockResolvedValue({
      ...observed,
      Config: {
        Labels: {
          ...observed.Config.Labels,
          'com.rebroid.application-id': 'another-app',
        },
      },
    });

    await expect(service.read(app.id, 'owner')).rejects.toMatchObject({
      status: 404,
    });
    await service.captureRunningApplications();
    expect(captureSnapshotPng).not.toHaveBeenCalled();
    await expect(repository.read(app.id)).resolves.toBeNull();
  });

  it('retains the latest image on a transient capture failure and clears it after an external stop', async () => {
    await service.captureRunningApplications();
    const previous = await service.read(app.id, 'owner');
    captureSnapshotPng.mockRejectedValue(new Error('ADB unavailable'));
    await service.captureRunningApplications();
    await expect(service.read(app.id, 'owner')).resolves.toEqual(previous);
    running = false;
    await expect(service.read(app.id, 'owner')).rejects.toMatchObject({
      status: 404,
    });
    await service.captureRunningApplications();
    await expect(readdir(snapshotDir)).resolves.toEqual([]);
  });

  it('only reads bounded headers when a refresh checks and removes a stale snapshot', async () => {
    await repository.replace(
      app.id,
      {
        runtimeKey: snapshotRuntimeKey(stored),
        containerStartedAt: initialStart,
        capturedAt: captureTime,
        content: Buffer.alloc(256 * 1024),
      },
      async () => true,
    );
    containerStartedAt = '2026-11-13T10:02:00.000000001Z';
    captureSnapshotPng.mockRejectedValue(new Error('ADB unavailable'));
    const open = fs.open;
    const reads: Array<jest.SpyInstance> = [];
    const observeOpen = jest
      .spyOn(fs, 'open')
      .mockImplementation(async (...args) => {
        const file = await open(...args);
        reads.push(jest.spyOn(file, 'read'));
        return file;
      });
    try {
      await service.captureRunningApplications();
      expect(
        reads.flatMap((read) =>
          read.mock.calls.map(([buffer]) => buffer.length),
        ),
      ).toEqual([512, 512]);
      await expect(readdir(snapshotDir)).resolves.toEqual([]);
    } finally {
      observeOpen.mockRestore();
    }
  });

  it('discards a capture when reconciliation stops the app during ADB work', async () => {
    await service.captureRunningApplications();
    const firstCapture = await captureSnapshotPng.mock.results[0].value;
    const writer = new AndroidAppsStateWriter(
      {
        updateReconciledRuntime: jest.fn(
          async (_previous, next: AndroidApplication) => {
            stored = next;
            return { affected: 1 };
          },
        ),
      } as never,
      {} as never,
      repository,
    );
    captureSnapshotPng.mockImplementation(async () => {
      await writer.saveReconciledRuntime(stored, {
        ...stored,
        status: AndroidApplicationStatus.Stopped,
      });
      return firstCapture;
    });
    await service.captureRunningApplications();
    await expect(readdir(snapshotDir)).resolves.toEqual([]);
  });

  it('discards a capture if Docker restarts the same container during ADB work', async () => {
    await service.captureRunningApplications();
    const image = await captureSnapshotPng.mock.results[0].value;
    captureSnapshotPng.mockImplementationOnce(async () => {
      containerStartedAt = '2026-11-13T10:02:00.000000001Z';
      return image;
    });
    await service.captureRunningApplications();
    await expect(readdir(snapshotDir)).resolves.toEqual([]);
    await expect(service.read(app.id, 'owner')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('keeps a new snapshot when cleanup was queued during replacement', async () => {
    await service.captureRunningApplications();
    const old = await repository.read(app.id);
    if (!old) throw new Error('Expected the initial snapshot.');

    let startPublishing!: () => void;
    const publishing = new Promise<void>((resolve) => {
      startPublishing = resolve;
    });
    let resumePublishing!: () => void;
    const held = new Promise<void>((resolve) => {
      resumePublishing = resolve;
    });
    stored = { ...app, lastStartedAt: new Date('2026-11-13T10:02:00Z') };
    const next = {
      ...old,
      runtimeKey: snapshotRuntimeKey(stored),
      containerStartedAt: '2026-11-13T10:02:00.000000001Z',
      capturedAt: '2026-11-13T10:03:00.000Z',
    };
    const replacement = repository.replace(app.id, next, async () => {
      startPublishing();
      await held;
      return true;
    });
    await publishing;
    const retired = repository.deleteObserved(app.id, old);
    const staleInventory = repository.prune(new Set());
    resumePublishing();
    await Promise.all([replacement, retired, staleInventory]);

    await expect(repository.read(app.id)).resolves.toMatchObject({
      runtimeKey: next.runtimeKey,
      containerStartedAt: next.containerStartedAt,
      capturedAt: next.capturedAt,
    });
    await expect(readdir(snapshotDir)).resolves.toEqual([`${app.id}.snapshot`]);
  });

  it('keeps a replacement with the same capture timestamp', async () => {
    await service.captureRunningApplications();
    const old = await repository.read(app.id);
    if (!old) throw new Error('Expected the initial snapshot.');

    await service.captureRunningApplications();
    await repository.deleteObserved(app.id, old);

    await expect(repository.read(app.id)).resolves.toMatchObject({
      recordId: expect.any(String),
      capturedAt: old.capturedAt,
    });
  });
});
