import fs from 'node:fs';
import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
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

const readTarHeaders = async (pack: Readable) =>
  new Promise<tar.Header[]>((resolve, reject) => {
    const extract = tar.extract();
    const headers: tar.Header[] = [];

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

      expect((await readTarHeaders(pack)).map(({ name }) => name)).toEqual([
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

  it('closes the file being streamed when a build abandons the archive', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'rebroid-abandoned-context-'),
    );
    const read = fs.createReadStream;
    let source: fs.ReadStream | undefined;
    const opened = new Promise<fs.ReadStream>((resolve) => {
      jest.spyOn(fs, 'createReadStream').mockImplementation((...args) => {
        source = read(...args);
        source.once('open', () => resolve(source!));
        return source;
      });
    });
    try {
      const path = join(directory, 'payload.bin');
      await writeFile(path, Buffer.alloc(256 * 1024));
      const archive = await createService().createTar('FROM scratch', [
        contextFile(path, 'payload'),
      ]);
      archive.on('error', () => undefined);
      const active = await opened;
      const closed = new Promise<boolean>((resolve) =>
        active.once('close', () => resolve(true)),
      );
      archive.destroy();
      expect(
        await Promise.race([closed, delay(2000, false, { ref: false })]),
      ).toBe(true);
    } finally {
      source?.destroy();
      jest.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('preserves source modes, symlinks and order in directory and filesystem contexts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-build-context-'));
    try {
      const path = join(directory, 'entrypoint');
      await writeFile(path, '#!/bin/sh\n');
      await chmod(path, 0o755);
      await symlink('entrypoint', join(directory, 'alias'));
      const service = createService();
      const tree = [
        expect.objectContaining({
          name: 'alias',
          type: 'symlink',
          linkname: 'entrypoint',
        }),
        expect.objectContaining({
          name: 'entrypoint',
          type: 'file',
          mode: 0o755,
        }),
      ];
      await expect(
        readTarHeaders(service.createDirectoryTar('FROM scratch', directory)),
      ).resolves.toEqual([
        expect.objectContaining({ name: 'Dockerfile', mode: 0o644 }),
        ...tree,
      ]);
      await expect(
        readTarHeaders(service.createFilesystemTar(directory)),
      ).resolves.toEqual(tree);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
