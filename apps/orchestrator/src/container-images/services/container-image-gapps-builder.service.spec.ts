import { Readable } from 'node:stream';
import type { DockerImageBuildRequest } from '../../docker/contracts/docker-image-runtime.port';
import { supportedGappsAndroidVersions } from '../dto/gapps-build.dto';
import { requiredRuntimeImageLabels } from '../utils/container-image-dockerfile-labels';
import { ContainerImageGappsBuilderService } from './container-image-gapps-builder.service';

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
      expect(build.jobs.appendLog).toHaveBeenCalledWith(
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
});

const runQueuedBuild = async (
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
  const job = {
    id: 'job-id',
    status: 'queued',
    androidVersion,
    targetImage: `local/redroid-gapps:${androidVersion}`,
    baseImage,
  };
  const jobs = {
    failInterruptedGappsJobs: jest.fn(),
    findNextQueuedGappsJob: jest
      .fn()
      .mockResolvedValueOnce(job)
      .mockResolvedValue(null),
    getJob: jest.fn().mockResolvedValue(job),
    markRunning: jest.fn().mockResolvedValue({ ...job, status: 'running' }),
    updateGappsDetails: jest.fn(),
    appendLog: jest.fn(),
    markSucceeded: jest.fn(),
    markFailed: jest.fn(),
  };
  const command = ['androidboot.use_memfd=true'];
  const context = Readable.from([]);
  const archive = {
    createDirectoryTar: jest.fn<Readable, [string, string]>(() => context),
  };
  const images = {
    pullImage: jest.fn(),
    inspectImage: jest
      .fn()
      .mockResolvedValueOnce({
        RepoDigests: [baseDigest],
        Config: {
          Entrypoint: ['/init', 'qemu=1', 'androidboot.hardware=redroid'],
          Cmd: command,
        },
      })
      .mockResolvedValueOnce({
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
      }),
    buildImage: jest.fn(async (request: DockerImageBuildRequest) => {
      request.onProgress?.('Installing payload', 'output');
    }),
  };
  const metadata = { upsert: jest.fn() };
  const service = new ContainerImageGappsBuilderService(
    jobs as never,
    { getPreset: () => ({ sourceBranch: 'fixture' }) } as never,
    { resolveRevision: () => 'fixture-revision' } as never,
    {
      findVerified: () => ({ sha256: 'checksum', packagePath: '/tmp/payload' }),
      retainOnly: async () => undefined,
    } as never,
    {} as never,
    {
      extract: () => '/tmp/work',
      validate: () => ({}),
      cleanup: jest.fn(),
    } as never,
    archive as never,
    images as never,
    metadata as never,
    {} as never,
  );

  await service.onModuleInit();
  await new Promise<void>((resolve) => setImmediate(resolve));
  return { archive, baseDigest, context, images, jobs, metadata };
};
