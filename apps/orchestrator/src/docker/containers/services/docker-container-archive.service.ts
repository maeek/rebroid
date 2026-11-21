import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { Readable } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { DockerEngineService } from '../../docker-engine.service';
import {
  DockerContainerArchiveReadLimitError,
  type DockerContainerArchivePort,
} from '../../contracts/docker-container-archive.port';

@Injectable()
export class DockerContainerArchiveService implements DockerContainerArchivePort {
  constructor(private readonly engine: DockerEngineService) {}

  async copyFileToContainer(
    containerId: string,
    sourcePath: string,
    targetDirectory: string,
    targetFileName?: string,
  ) {
    const { size } = await stat(sourcePath);
    await this.copyStreamToContainer(
      containerId,
      Readable.from(
        (async function* () {
          yield* createReadStream(sourcePath);
        })(),
      ),
      targetDirectory,
      targetFileName ?? basename(sourcePath),
      size,
    );
  }

  copyBufferToContainer(
    containerId: string,
    content: Buffer,
    targetDirectory: string,
    targetFileName: string,
  ) {
    return this.copyStreamToContainer(
      containerId,
      Readable.from([content]),
      targetDirectory,
      targetFileName,
      content.length,
    );
  }

  copyStreamToContainer(
    containerId: string,
    content: Readable,
    targetDirectory: string,
    targetFileName: string,
    size?: number,
  ) {
    return this.engine.longOperation(
      'archive_upload',
      `Upload archive to container ${containerId}`,
      async (docker, signal) => {
        const container = docker.getContainer(containerId);
        const pack = tar.pack();
        const entry = pack.entry({ name: targetFileName, mode: 0o644, size });
        const archive = Readable.from(pack, { objectMode: false });
        const archiveDone = finished(archive, { cleanup: true });
        const forwardPackError = (error: Error) => archive.destroy(error);
        pack.on('error', forwardPackError);
        const cancellation = new AbortController();
        const transferSignal = AbortSignal.any([signal, cancellation.signal]);
        const closeArchive = () => {
          archive.destroy();
          pack.destroy();
        };
        transferSignal.addEventListener('abort', closeArchive, { once: true });

        const upload = Promise.resolve().then(() =>
          container.putArchive(archive, {
            path: targetDirectory,
            abortSignal: transferSignal,
          }),
        );
        const input = pipeline(content, entry, { signal: transferSignal }).then(
          () => pack.finalize(),
        );
        try {
          await Promise.all([input, archiveDone, upload]);
        } catch (error) {
          cancellation.abort(error);
          await Promise.allSettled([input, archiveDone, upload]);
          throw error;
        } finally {
          transferSignal.removeEventListener('abort', closeArchive);
          pack.off('error', forwardPackError);
        }
      },
      undefined,
      { waitForCleanup: true },
    );
  }

  async readFileFromContainer(
    containerId: string,
    containerPath: string,
    options: { maximumBytes?: number } = {},
  ) {
    return this.engine.longOperation(
      'archive_download',
      `Download archive from container ${containerId}`,
      async (docker, signal) => {
        const container = docker.getContainer(containerId);
        const archive = await container.getArchive({
          path: containerPath,
          abortSignal: signal,
        });
        const extract = tar.extract();
        const abort = () => {
          const error = new Error('Docker archive download aborted.');
          (archive as unknown as Readable).destroy(error);
          extract.destroy(error);
        };
        signal.addEventListener('abort', abort, { once: true });

        try {
          return await new Promise<Buffer>((resolve, reject) => {
            let file: Buffer | undefined;

            extract.on('entry', (header, stream, next) => {
              const chunks: Buffer[] = [];
              let totalBytes = 0;

              stream.on('data', (chunk) => {
                if (header.type !== 'file') {
                  return;
                }
                if (!(chunk instanceof Uint8Array)) {
                  extract.destroy(
                    new Error('Expected bytes in Docker archive.'),
                  );
                  return;
                }
                totalBytes += chunk.byteLength;
                if (
                  options.maximumBytes !== undefined &&
                  totalBytes > options.maximumBytes
                ) {
                  const error = new DockerContainerArchiveReadLimitError(
                    options.maximumBytes,
                  );
                  stream.destroy(error);
                  extract.destroy(error);
                  (archive as unknown as Readable).destroy(error);
                  reject(error);
                  return;
                }
                chunks.push(Buffer.from(chunk));
              });

              stream.on('end', () => {
                if (!file && header.type === 'file') {
                  file = Buffer.concat(chunks);
                }
                next();
              });

              stream.on('error', reject);
              stream.resume();
            });

            extract.on('finish', () => {
              if (file) {
                resolve(file);
                return;
              }
              reject(new Error('File was not present in the Docker archive.'));
            });
            extract.on('error', reject);
            archive.on('error', reject);
            archive.pipe(extract);
          });
        } finally {
          signal.removeEventListener('abort', abort);
        }
      },
    );
  }
}
