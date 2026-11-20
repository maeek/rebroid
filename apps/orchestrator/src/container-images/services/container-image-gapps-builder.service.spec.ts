import { Readable } from 'node:stream';
import type { DockerImageBuildRequest } from '../../docker/contracts/docker-image-runtime.port';
import { supportedGappsAndroidVersions } from '../dto/gapps-build.dto';
import type { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import { requiredRuntimeImageLabels } from '../utils/container-image-dockerfile-labels';
import type { ContainerImageBuildJobService } from './container-image-build-job.service';
import { ContainerImageBuildLifecycleService } from './container-image-build-lifecycle.service';
import { ContainerImageGappsBuilderService } from './container-image-gapps-builder.service';

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
};

describe('ContainerImageGappsBuilderService', () => {
  it.each(supportedGappsAndroidVersions)(
    'keeps ReDroid init and its boot arguments for Android %s',
    async (androidVersion) => {
      const build = await runQueuedBuild(androidVersion);

      expect(build.archive.createDirectoryTar).toHaveBeenCalledWith(
        expect.stringContaining(
          'ENTRYPOINT ["/init","qemu=1","androidboot.hardware=redroid","ro.setupwizard.mode=DISABLED"]',
        ),
        '/tmp/work',
      );
      const [dockerfile] = build.archive.createDirectoryTar.mock.calls[0]!;
      expect(dockerfile).toContain(`FROM ${build.baseDigest}\n`);
      expect(dockerfile).toContain('USER 0:0\nCOPY system/ /system/\n');
      expect(dockerfile).toContain('CMD ["androidboot.use_memfd=true"]\n');
      expect(dockerfile).not.toContain('COPY --chmod');
      expect(build.images.buildImage).toHaveBeenCalledWith(
        expect.objectContaining({
          context: build.context,
          targetImage: `local/redroid-gapps:${androidVersion}`,
          operationName: 'container_image_gapps_patch',
          timeoutMs: 60 * 60 * 1000,
          signal: expect.any(AbortSignal),
        }),
      );
      expect(build.jobs.recordProgress).toHaveBeenCalledWith(
        'job-id',
        'Installing payload',
      );
      expect(build.jobs.markSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'job-id' }),
        'built-image-id',
      );
    },
  );

  it('fails the build if the output image uses the old shell launcher', async () => {
    const build = await runQueuedBuild('15', [
      '/usr/local/bin/rebroid-gapps-entrypoint',
    ]);

    expect(build.jobs.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-id' }),
      'Built image local/redroid-gapps:15 has an unexpected startup command.',
    );
    expect(build.metadata.upsert).not.toHaveBeenCalled();
    expect(build.jobs.markSucceeded).not.toHaveBeenCalled();
  });

  it('returns the cancelled row while cleanup keeps the build active and the next job queued', async () => {
    const build = createQueuedBuild('15');
    const nextJob = build.addJob('next-job');
    const buildStarted = deferred<AbortSignal>();
    const saveCancellation = deferred<void>();
    const cleanupStarted = deferred<void>();
    const finishCleanup = deferred<void>();
    const markCancelled = build.jobs.markCancelled.getMockImplementation()!;
    build.jobs.markCancelled.mockImplementationOnce(async (job) => {
      await saveCancellation.promise;
      return markCancelled(job);
    });
    build.images.buildImage.mockImplementationOnce(({ signal }) => {
      if (!signal) throw new Error('Missing cancellation signal');
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
        buildStarted.resolve(signal);
      });
    });
    build.packages.cleanup.mockImplementationOnce(() => {
      cleanupStarted.resolve();
      return finishCleanup.promise;
    });

    try {
      await build.service.onModuleInit();
      const signal = await buildStarted.promise;
      const cancelled = build.lifecycle.cancelBuild('job-id');
      await nextTurn();
      expect(signal.aborted).toBe(false);
      saveCancellation.resolve();
      await expect(cancelled).resolves.toMatchObject({ status: 'cancelled' });
      await cleanupStarted.promise;
      await expect(
        build.lifecycle.cancelBuild('job-id'),
      ).resolves.toMatchObject({ status: 'cancelled' });
      expect(build.lifecycle.activeBuildIds()).toEqual(['job-id']);
      expect(nextJob.status).toBe('queued');
      expect(build.images.buildImage).toHaveBeenCalledTimes(1);
      expect(build.jobs.markCancelled).toHaveBeenCalledTimes(1);

      finishCleanup.resolve();
      await nextTurn();
      expect(nextJob.status).toBe('succeeded');
      expect(build.lifecycle.activeBuildIds()).toEqual([]);
    } finally {
      saveCancellation.resolve();
      finishCleanup.resolve();
      build.service.onModuleDestroy();
    }
  });

  it('skips build work when a selected job is cancelled before its claim', async () => {
    const build = createQueuedBuild('15');
    const claimStarted = deferred<void>();
    const claimAllowed = deferred<void>();
    const markRunning = build.jobs.markRunning.getMockImplementation()!;
    build.jobs.markRunning.mockImplementationOnce(async (job) => {
      claimStarted.resolve();
      await claimAllowed.promise;
      return markRunning(job);
    });

    try {
      await build.service.onModuleInit();
      await claimStarted.promise;
      await expect(
        build.lifecycle.cancelBuild('job-id'),
      ).resolves.toMatchObject({ status: 'cancelled' });
      claimAllowed.resolve();
      await nextTurn();
      expect(build.images.pullImage).not.toHaveBeenCalled();
      expect(build.images.buildImage).not.toHaveBeenCalled();
      expect(build.lifecycle.activeBuildIds()).toEqual([]);
    } finally {
      claimAllowed.resolve();
      build.service.onModuleDestroy();
    }
  });

  it('returns success when completion wins the cancellation race', async () => {
    const build = createQueuedBuild('15');
    const buildStarted = deferred<AbortSignal>();
    const finishBuild = deferred<void>();
    const saveCancellation = deferred<void>();
    const markCancelled = build.jobs.markCancelled.getMockImplementation()!;
    build.jobs.markCancelled.mockImplementationOnce(async (job) => {
      await saveCancellation.promise;
      return markCancelled(job);
    });
    build.images.buildImage.mockImplementationOnce(({ signal }) => {
      if (!signal) throw new Error('Missing cancellation signal');
      buildStarted.resolve(signal);
      return finishBuild.promise;
    });

    try {
      await build.service.onModuleInit();
      const signal = await buildStarted.promise;
      const cancelled = build.lifecycle.cancelBuild('job-id');
      await nextTurn();
      finishBuild.resolve();
      await nextTurn();
      saveCancellation.resolve();
      await expect(cancelled).resolves.toMatchObject({ status: 'succeeded' });
      expect(signal.aborted).toBe(false);
    } finally {
      finishBuild.resolve();
      saveCancellation.resolve();
      build.service.onModuleDestroy();
    }
  });

  it('holds the next GApps job until Docker confirms an interrupted worker has stopped', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'setImmediate'] });
    const build = createQueuedBuild('15');
    const nextJob = build.addJob('next-job');
    const workerStarted = deferred<AbortSignal>();
    const finishWorker = deferred<string>();
    build.cache.findVerified.mockResolvedValueOnce(null);
    build.packageWorker.buildPackage.mockImplementationOnce(
      (
        _id: string,
        _preset: unknown,
        _revision: string,
        signal: AbortSignal,
      ) => {
        workerStarted.resolve(signal);
        return finishWorker.promise;
      },
    );

    try {
      await build.service.onModuleInit();
      const signal = await workerStarted.promise;
      await expect(
        build.lifecycle.cancelBuild('job-id'),
      ).resolves.toMatchObject({ status: 'cancelled' });
      expect(signal.aborted).toBe(true);
      expect(nextJob.status).toBe('queued');

      build.workerInventory.hasUnstoppedWorkers.mockResolvedValue(true);
      finishWorker.reject(new Error('Could not confirm worker shutdown'));
      await nextTurn();
      expect(build.lifecycle.activeBuildIds()).toEqual(['job-id']);
      expect(nextJob.status).toBe('queued');
      expect(build.jobs.markRunning).toHaveBeenCalledTimes(1);

      build.workerInventory.hasUnstoppedWorkers.mockRejectedValueOnce(
        new Error('Docker unavailable'),
      );
      await jest.advanceTimersByTimeAsync(5_000);
      expect(nextJob.status).toBe('queued');
      expect(build.jobs.markRunning).toHaveBeenCalledTimes(1);

      build.workerInventory.hasUnstoppedWorkers.mockResolvedValue(false);
      await jest.advanceTimersByTimeAsync(5_000);
      await nextTurn();
      expect(nextJob.status).toBe('succeeded');
      expect(build.lifecycle.activeBuildIds()).toEqual([]);
    } finally {
      build.service.onModuleDestroy();
      jest.useRealTimers();
    }
  });
});

const runQueuedBuild = async (
  androidVersion: (typeof supportedGappsAndroidVersions)[number],
  outputEntrypoint?: string[],
) => {
  const build = createQueuedBuild(androidVersion, outputEntrypoint);
  await build.service.onModuleInit();
  await nextTurn();
  return build;
};

const createQueuedBuild = (
  androidVersion: (typeof supportedGappsAndroidVersions)[number],
  outputEntrypoint = [
    '/init',
    'qemu=1',
    'androidboot.hardware=redroid',
    'ro.setupwizard.mode=DISABLED',
  ],
) => {
  const baseImage = `redroid/redroid:${androidVersion}.0.0-latest`;
  const baseDigest = `redroid/redroid@sha256:${'a'.repeat(64)}`;
  const rows = new Map<string, ContainerImageBuildJob>();
  const addJob = (id: string) => {
    const row = {
      id,
      status: 'queued',
      buildKind: 'redroid_gapps_patch',
      androidVersion,
      targetImage: `local/redroid-gapps:${androidVersion}`,
      baseImage,
    } as ContainerImageBuildJob;
    rows.set(id, row);
    return row;
  };
  const job = addJob('job-id');
  const rowFor = (id: string) => rows.get(id)!;
  const jobs = {
    failInterruptedJobs: jest.fn(),
    findNextQueuedGappsJob: jest.fn(async () => {
      const next = [...rows.values()].find(({ status }) => status === 'queued');
      return next ? { ...next } : null;
    }),
    getJob: jest.fn(async (id: string) => ({ ...rowFor(id) })),
    isTerminal: (status: string) => status !== 'queued' && status !== 'running',
    markRunning: jest.fn(async ({ id }: ContainerImageBuildJob) => {
      const row = rowFor(id);
      if (row.status !== 'queued') return false;
      row.status = 'running';
      return true;
    }),
    markCancelled: jest.fn(async ({ id }: ContainerImageBuildJob) => {
      const row = rowFor(id);
      if (row.status === 'queued' || row.status === 'running')
        row.status = 'cancelled';
      return { ...row };
    }),
    updateGappsDetails: jest.fn(),
    appendLog: jest.fn(),
    recordProgress: jest.fn(),
    markSucceeded: jest.fn(async ({ id }: ContainerImageBuildJob) => {
      const row = rowFor(id);
      if (row.status === 'running') row.status = 'succeeded';
      return { ...row };
    }),
    markFailed: jest.fn(async ({ id }: ContainerImageBuildJob) => {
      const row = rowFor(id);
      if (row.status === 'queued' || row.status === 'running')
        row.status = 'failed';
      return { ...row };
    }),
  };
  const command = ['androidboot.use_memfd=true'];
  const context = Readable.from([]);
  const archive = {
    createDirectoryTar: jest.fn<Readable, [string, string]>(() => context),
  };
  const images = {
    pullImage: jest.fn(),
    inspectImage: jest.fn().mockImplementation(async (image: string) =>
      image === baseImage
        ? {
            RepoDigests: [baseDigest],
            Config: {
              Entrypoint: ['/init', 'qemu=1', 'androidboot.hardware=redroid'],
              Cmd: command,
            },
          }
        : {
            Id: 'built-image-id',
            RepoTags: [job.targetImage],
            Config: {
              Entrypoint: outputEntrypoint,
              Cmd: command,
              Labels: requiredRuntimeImageLabels({
                runtimeKind: 'redroid',
                androidVersion,
                architecture: 'amd64',
                gmsMode: 'gapps',
                signatureSpoofing: 'not_applicable',
              }),
            },
          },
    ),
    buildImage: jest.fn(async (request: DockerImageBuildRequest) => {
      request.onProgress?.('Installing payload', 'output');
    }),
  };
  const metadata = { upsert: jest.fn() };
  const workerInventory = {
    hasUnstoppedWorkers: jest.fn().mockResolvedValue(false),
    run: jest.fn(),
  };
  const jobService = jobs as unknown as ContainerImageBuildJobService;
  const lifecycle = new ContainerImageBuildLifecycleService(
    jobService,
    workerInventory,
  );
  const cache = {
    findVerified: jest
      .fn()
      .mockResolvedValue({ sha256: 'checksum', packagePath: '/tmp/payload' }),
    retainOnly: jest.fn().mockResolvedValue(undefined),
  };
  const packageWorker = { buildPackage: jest.fn() };
  const packages = {
    extract: () => '/tmp/work',
    validate: () => ({}),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ContainerImageGappsBuilderService(
    jobService,
    { getPreset: () => ({ sourceBranch: 'fixture' }) } as never,
    { resolveRevision: () => 'fixture-revision' } as never,
    cache as never,
    packageWorker as never,
    packages as never,
    archive as never,
    images as never,
    metadata as never,
    {} as never,
    lifecycle,
  );

  return {
    service,
    lifecycle,
    addJob,
    packages,
    cache,
    packageWorker,
    workerInventory,
    archive,
    baseDigest,
    context,
    images,
    jobs,
    metadata,
  };
};
