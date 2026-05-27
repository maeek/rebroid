import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { DockerEngineService } from '../../docker-engine.service';

@Injectable()
export class DockerContainerArchiveService {
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
    const container = this.engine.docker.getContainer(containerId);
    const pack = tar.pack();

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
    });
  }

  async copyStreamToContainer(
    containerId: string,
    content: Readable,
    targetDirectory: string,
    targetFileName: string,
    size?: number,
  ) {
    const container = this.engine.docker.getContainer(containerId);
    const pack = tar.pack();
    const archiveUpload = container
      .putArchive(pack, {
        path: targetDirectory,
      })
      .catch((error: unknown) => {
        pack.destroy(error instanceof Error ? error : new Error(String(error)));
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
      pack.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async readFileFromContainer(containerId: string, containerPath: string) {
    const container = this.engine.docker.getContainer(containerId);
    const archive = await container.getArchive({ path: containerPath });
    const extract = tar.extract();

    return new Promise<Buffer>((resolve, reject) => {
      let resolved = false;

      extract.on('entry', (header, stream, next) => {
        const chunks: Buffer[] = [];

        stream.on('data', (chunk: Buffer) => {
          chunks.push(Buffer.from(chunk));
        });

        stream.on('end', () => {
          if (!resolved && header.type === 'file') {
            resolved = true;
            resolve(Buffer.concat(chunks));
          }
          next();
        });

        stream.on('error', reject);
        stream.resume();
      });

      extract.on('finish', () => {
        if (!resolved) {
          reject(new Error('File was not present in the Docker archive.'));
        }
      });
      extract.on('error', reject);
      archive.on('error', reject);
      archive.pipe(extract);
    });
  }
}
