import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { DockerEngineService } from '../../docker-engine.service';
import type { DockerContainerArchivePort } from '../../contracts/docker-container-archive.port';

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
      createReadStream(sourcePath),
      targetDirectory,
      targetFileName ?? basename(sourcePath),
      size,
    );
  }

  async copyBufferToContainer(
    containerId: string,
    content: Buffer,
    targetDirectory: string,
    targetFileName: string,
  ) {
    await this.engine.longOperation(
      'archive_upload',
      `Upload archive to container ${containerId}`,
      async (docker, signal) => {
        const container = docker.getContainer(containerId);
        const pack = tar.pack();
        const abort = () =>
          pack.destroy(new Error('Docker archive upload aborted.'));
        signal.addEventListener('abort', abort, { once: true });
        try {
          await new Promise<void>((resolve, reject) => {
            pack.entry(
              {
                name: targetFileName,
                mode: 0o644,
                size: content.length,
              },
              content,
              (error) => {
                if (error) {
                  reject(error);
                  return;
                }

                pack.finalize();
                resolve();
              },
            );
          });

          await container.putArchive(pack, {
            path: targetDirectory,
            abortSignal: signal,
          });
        } finally {
          signal.removeEventListener('abort', abort);
        }
      },
    );
  }

  async copyStreamToContainer(
    containerId: string,
    content: Readable,
    targetDirectory: string,
    targetFileName: string,
    size?: number,
  ) {
    await this.engine.longOperation(
      'archive_upload',
      `Upload archive to container ${containerId}`,
      async (docker, signal) => {
        const container = docker.getContainer(containerId);
        const pack = tar.pack();
        const abort = () => {
          const error = new Error('Docker archive upload aborted.');
          content.destroy(error);
          pack.destroy(error);
        };
        signal.addEventListener('abort', abort, { once: true });
        const archiveUpload = container
          .putArchive(pack, {
            path: targetDirectory,
            abortSignal: signal,
          })
          .catch((error: unknown) => {
            pack.destroy(
              error instanceof Error ? error : new Error(String(error)),
            );
            throw error;
          });
        const entry = pack.entry({
          name: targetFileName,
          mode: 0o644,
          size,
        });

        try {
          await pipeline(content, entry);
          pack.finalize();
          await archiveUpload;
        } catch (error) {
          pack.destroy(
            error instanceof Error ? error : new Error(String(error)),
          );
          throw error;
        } finally {
          signal.removeEventListener('abort', abort);
        }
      },
    );
  }

  async readFileFromContainer(containerId: string, containerPath: string) {
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

              stream.on('data', (chunk: Buffer) => {
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
