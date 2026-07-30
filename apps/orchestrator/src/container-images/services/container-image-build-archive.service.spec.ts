import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import tar from 'tar-stream';
import { ContainerImageBuildContextFile } from '../entities/container-image-build-context-file.entity';
import { ContainerImageBuildArchiveService } from './container-image-build-archive.service';

const createService = () => new ContainerImageBuildArchiveService();

const contextFile = (
  storedPath: string,
  contextPath: string,
): ContainerImageBuildContextFile => ({
  id: contextPath,
  originalName: contextPath.split('/').pop() ?? contextPath,
  contextPath,
  storedPath,
  sizeBytes: 0,
  sha256: 'sha256',
  createdAt: new Date(),
});

const readTarEntries = async (pack: tar.Pack) =>
  new Promise<string[]>((resolve, reject) => {
    const extract = tar.extract();
    const entries: string[] = [];

    extract.on('entry', (header, stream, next) => {
      entries.push(header.name);
      stream.on('end', next);
      stream.resume();
    });
    extract.on('finish', () => resolve(entries));
    extract.on('error', reject);
    pack.on('error', reject);
    pack.pipe(extract);
  });

const readTarHeaders = async (pack: tar.Pack) =>
  new Promise<tar.Headers[]>((resolve, reject) => {
    const extract = tar.extract();
    const headers: tar.Headers[] = [];

    extract.on('entry', (header, stream, next) => {
      headers.push(header);
      stream.on('end', next);
      stream.resume();
    });
    extract.on('finish', () => resolve(headers));
    extract.on('error', reject);
    pack.on('error', reject);
    pack.pipe(extract);
  });

describe('ContainerImageBuildArchiveService', () => {
  it('streams Dockerfile and context files into a tar archive', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-build-context-'));
    try {
      const apkPath = join(directory, 'GmsCore.apk');
      await writeFile(apkPath, 'apk');

      const pack = await createService().createTar('FROM scratch', [
        contextFile(apkPath, 'apks/GmsCore.apk'),
      ]);

      await expect(readTarEntries(pack)).resolves.toEqual([
        'Dockerfile',
        'apks/GmsCore.apk',
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('returns the tar stream before large entries are consumed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-build-context-'));
    try {
      const payloadPath = join(directory, 'payload.bin');
      await writeFile(payloadPath, Buffer.alloc(4 * 1024 * 1024, 1));

      const result = await Promise.race([
        createService()
          .createTar('FROM scratch', [contextFile(payloadPath, 'payload.bin')])
          .then((pack) => ({ pack, status: 'resolved' as const })),
        delay(250).then(() => ({ pack: null, status: 'timeout' as const })),
      ]);

      expect(result.status).toBe('resolved');
      result.pack?.on('error', () => undefined);
      result.pack?.destroy();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('preserves explicit modes for generated context files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-build-context-'));
    try {
      const pack = createService().createDirectoryTar(
        'FROM scratch',
        directory,
        {
          entrypoint: {
            content: Buffer.from('#!/bin/sh\n'),
            mode: 0o755,
          },
        },
      );

      const headers = await readTarHeaders(pack);
      expect(headers.find((header) => header.name === 'entrypoint')?.mode).toBe(
        0o755,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
