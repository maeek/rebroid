import { ConflictException, Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import tar from 'tar-stream';
import { getErrorMessage } from '../../common/error-message';
import { ContainerImageBuildContextFile } from '../entities/container-image-build-context-file.entity';
import { sanitizeBuildContextPath } from '../utils/container-image-build-paths';

type ContainerImageBuildArchiveExtraFile = {
  content: Buffer;
  mode?: number;
};

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

  createDirectoryTar(
    dockerfile: string,
    rootDirectory: string,
    extraFiles: Record<string, ContainerImageBuildArchiveExtraFile> = {},
  ) {
    const pack = tar.pack();
    void this.writeDirectoryEntries(
      pack,
      dockerfile,
      rootDirectory,
      extraFiles,
    );
    return pack;
  }

  createFilesystemTar(rootDirectory: string) {
    const pack = tar.pack();
    void this.writeFilesystemEntries(pack, rootDirectory);
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

  private async addBuffer(
    pack: tar.Pack,
    name: string,
    content: Buffer,
    mode = 0o644,
  ) {
    await new Promise<void>((resolve, reject) => {
      pack.entry(
        { name, mode, size: content.length, type: 'file' },
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

  private async writeDirectoryEntries(
    pack: tar.Pack,
    dockerfile: string,
    rootDirectory: string,
    extraFiles: Record<string, ContainerImageBuildArchiveExtraFile>,
  ) {
    try {
      await this.addBuffer(pack, 'Dockerfile', Buffer.from(dockerfile));
      for (const [name, file] of Object.entries(extraFiles)) {
        await this.addBuffer(
          pack,
          sanitizeBuildContextPath(name),
          file.content,
          file.mode,
        );
      }
      await this.addDirectoryTree(pack, rootDirectory);
      pack.finalize();
    } catch (error) {
      pack.destroy(new Error(getErrorMessage(error)));
    }
  }

  private async writeFilesystemEntries(pack: tar.Pack, rootDirectory: string) {
    try {
      await this.addDirectoryTree(pack, rootDirectory);
      pack.finalize();
    } catch (error) {
      pack.destroy(new Error(getErrorMessage(error)));
    }
  }

  private async addDirectoryTree(
    pack: tar.Pack,
    rootDirectory: string,
    relativeDirectory = '',
  ) {
    const entries = await readdir(join(rootDirectory, relativeDirectory), {
      withFileTypes: true,
    });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = join(rootDirectory, relativePath);
      const fileStat = await lstat(absolutePath);
      const mode = fileStat.mode & 0o1777;
      if (fileStat.isDirectory()) {
        await this.addHeader(pack, {
          name: `${relativePath}/`,
          mode,
          type: 'directory',
        });
        await this.addDirectoryTree(pack, rootDirectory, relativePath);
        continue;
      }
      if (fileStat.isSymbolicLink()) {
        await this.addHeader(pack, {
          name: relativePath,
          mode,
          type: 'symlink',
          linkname: await readlink(absolutePath),
        });
        continue;
      }
      if (!fileStat.isFile()) {
        throw new ConflictException(
          `Build context contains an unsupported entry: ${relativePath}`,
        );
      }
      await this.addFileWithMode(
        pack,
        relativePath,
        absolutePath,
        fileStat.size,
        mode,
      );
    }
  }

  private addHeader(pack: tar.Pack, header: tar.Headers) {
    return new Promise<void>((resolve, reject) => {
      pack.entry(header, (error) => (error ? reject(error) : resolve()));
    });
  }

  private async addFileWithMode(
    pack: tar.Pack,
    name: string,
    filePath: string,
    size: number,
    mode: number,
  ) {
    await new Promise<void>((resolve, reject) => {
      const entry = pack.entry({ name, mode, size, type: 'file' }, (error) =>
        error ? reject(error) : resolve(),
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
