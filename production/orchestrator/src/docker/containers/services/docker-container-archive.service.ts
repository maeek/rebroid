import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
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
    const content = await readFile(sourcePath);
    await this.copyBufferToContainer(
      containerId,
      content,
      targetDirectory,
      targetFileName ?? basename(sourcePath),
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
