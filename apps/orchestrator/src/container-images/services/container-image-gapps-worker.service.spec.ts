import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import tar from 'tar-stream';
import type { DockerGappsWorkerRequest } from '../../docker/contracts/docker-gapps-worker.port';
import type { GappsBuildPresetDto } from '../dto/gapps-build.dto';
import { ContainerImageGappsWorkerService } from './container-image-gapps-worker.service';

const makeArchive = () => {
  const archive = tar.pack();
  archive.entry({ name: 'package.zip' }, Buffer.from('package content'));
  archive.finalize();
  return Readable.from(archive, { objectMode: false });
};

describe('ContainerImageGappsWorkerService package transfer', () => {
  let directory: string;
  let destination: string;
  const preset = {
    androidVersion: '16',
    sourceRepository: 'repo',
  } as GappsBuildPresetDto;
  const setup = (
    run: (request: DockerGappsWorkerRequest) => Promise<void>,
    imageExists = async () => true,
    buildImage = jest.fn(),
  ) =>
    new ContainerImageGappsWorkerService(
      { getOrThrow: () => 'worker:test' } as unknown as ConfigService,
      { run, hasUnstoppedWorkers: async () => false },
      {
        imageExists,
        buildImage,
        inspectImage: async () => ({
          Config: { Labels: { 'com.rebroid.gapps-patcher.version': '2' } },
        }),
      } as never,
      { createFilesystemTar: () => Readable.from([]) } as never,
      {} as never,
      {
        createTemporaryPath: async () => destination,
        removeTemporary: async (path: string) => rm(path, { force: true }),
      } as never,
    );

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-gapps-worker-'));
    destination = join(directory, 'package.zip');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes the complete package before returning the path', async () => {
    const run = jest.fn(
      ({ consumeArchive, signal }: DockerGappsWorkerRequest) =>
        consumeArchive(makeArchive(), signal),
    );
    const service = setup(run);
    await expect(
      service.buildPackage(
        'job',
        preset,
        'revision',
        new AbortController().signal,
      ),
    ).resolves.toBe(destination);
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ androidVersion: '16' }),
    );
    await expect(readFile(destination, 'utf8')).resolves.toBe(
      'package content',
    );
  });

  it('drains other files and retains the first package in archive order', async () => {
    const archive = tar.pack();
    archive.entry({ name: 'build/output.log' }, 'done');
    archive.entry({ name: 'build/package.zip' }, 'first');
    archive.entry({ name: 'extra/package.zip' }, 'second');
    archive.entry({ name: 'build/info.json' }, '{}');
    archive.finalize();
    const service = setup(({ consumeArchive, signal }) =>
      consumeArchive(Readable.from(archive, { objectMode: false }), signal),
    );
    await service.buildPackage(
      'job',
      preset,
      'revision',
      new AbortController().signal,
    );
    await expect(readFile(destination, 'utf8')).resolves.toBe('first');
  });

  it('propagates a failed archive transfer and cleans its staged output', async () => {
    const prefix = (await buffer(makeArchive())).subarray(0, 516);
    const error = new Error('archive transfer failed');
    const source = Readable.from(
      (async function* () {
        yield prefix;
        throw error;
      })(),
    );
    const service = setup(({ consumeArchive, signal }) =>
      consumeArchive(source, signal),
    );
    await expect(
      service.buildPackage(
        'job',
        preset,
        'revision',
        new AbortController().signal,
      ),
    ).rejects.toBe(error);
    await expect(readFile(destination)).rejects.toHaveProperty(
      'code',
      'ENOENT',
    );
  });

  it('removes a partially transferred package on cancellation', async () => {
    const archivePrefix = (await buffer(makeArchive())).subarray(0, 516);
    const abort = new AbortController();
    const stream = new PassThrough();
    const service = setup(({ consumeArchive, signal }) => {
      const pending = consumeArchive(stream, signal);
      stream.write(archivePrefix);
      setImmediate(() => abort.abort(new Error('job cancelled')));
      return pending;
    });
    await expect(
      service.buildPackage('job', preset, 'revision', abort.signal),
    ).rejects.toThrow('aborted');
    expect(stream.destroyed).toBe(true);
    await expect(readFile(destination)).rejects.toHaveProperty(
      'code',
      'ENOENT',
    );
  });

  it('rebuilds a worker image pruned between package jobs', async () => {
    const imageExists = jest
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const buildImage = jest.fn();
    const service = setup(async () => {}, imageExists, buildImage);
    const signal = new AbortController().signal;
    await service.buildPackage('first', preset, 'revision', signal);
    expect(buildImage).not.toHaveBeenCalled();
    await service.buildPackage('second', preset, 'revision', signal);
    expect(buildImage).toHaveBeenCalledTimes(1);
  });
});
