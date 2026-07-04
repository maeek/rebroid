import { ConflictException, Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import tar from 'tar-stream';
import { getErrorMessage } from '../../common/error-message';
import { ContainerImageBuildContextFile } from '../entities/container-image-build-context-file.entity';
import { sanitizeBuildContextPath } from '../utils/container-image-build-paths';

@Injectable()
export class ContainerImageBuildArchiveService {
  async createTar(
    dockerfile: string,
    contextFiles: ContainerImageBuildContextFile[],
  ) {
    const files = await this.prepareTarFiles(contextFiles);
    const pack = tar.pack();

    void this.writeTarEntries(pack, dockerfile, files);
    return pack;
  }

  private async prepareTarFiles(
    contextFiles: ContainerImageBuildContextFile[],
  ) {
    const files: Array<{
      contextPath: string;
      storedPath: string;
      size: number;
    }> = [];
    const usedPaths = new Set(['Dockerfile']);
    for (const file of contextFiles) {
      const contextPath = sanitizeBuildContextPath(file.contextPath);
      if (usedPaths.has(contextPath)) {
        throw new ConflictException(
          `Build context path is duplicated: ${contextPath}`,
        );
      }

      const fileStat = await stat(file.storedPath);
      if (!fileStat.isFile()) {
        throw new ConflictException(
          `Build context entry is not a regular file: ${contextPath}`,
        );
      }

      usedPaths.add(contextPath);
      files.push({
        contextPath,
        storedPath: file.storedPath,
        size: fileStat.size,
      });
    }

    return files;
  }

  private async writeTarEntries(
    pack: tar.Pack,
    dockerfile: string,
    files: Array<{ contextPath: string; storedPath: string; size: number }>,
  ) {
    try {
      await this.addBuffer(pack, 'Dockerfile', Buffer.from(dockerfile));
      for (const file of files) {
        await this.addFile(pack, file.contextPath, file.storedPath, file.size);
      }
      pack.finalize();
    } catch (error) {
      pack.destroy(new Error(getErrorMessage(error)));
    }
  }

  private async addBuffer(pack: tar.Pack, name: string, content: Buffer) {
    await new Promise<void>((resolve, reject) => {
      pack.entry(
        { name, mode: 0o644, size: content.length, type: 'file' },
        content,
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  private async addFile(
    pack: tar.Pack,
    name: string,
    filePath: string,
    size: number,
  ) {
    await new Promise<void>((resolve, reject) => {
      const entry = pack.entry(
        { name, mode: 0o644, size, type: 'file' },
        (error) => (error ? reject(error) : resolve()),
      );
      const source = createReadStream(filePath);
      source.on('error', (error) => {
        entry.destroy(error);
        reject(error);
      });
      entry.on('error', reject);
      source.pipe(entry);
    });
  }
}
