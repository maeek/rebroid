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
  const setup = (run: (request: DockerGappsWorkerRequest) => Promise<void>) =>
    new ContainerImageGappsWorkerService(
      { getOrThrow: () => 'worker:test' } as unknown as ConfigService,
      { run },
      {
        imageExists: async () => true,
        inspectImage: async () => ({
          Config: { Labels: { 'com.rebroid.gapps-patcher.version': '2' } },
        }),
      } as never,
      {} as never,
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
});
