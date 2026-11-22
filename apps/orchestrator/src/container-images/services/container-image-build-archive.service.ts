import { ConflictException, Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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
    return this.createArchive(async (pack) => {
      await this.addDockerfile(pack, dockerfile);
      for (const { contextPath, storedPath, size } of files) {
        await this.addFile(pack, contextPath, storedPath, size);
      }
    });
  }

  createDirectoryTar(dockerfile: string, rootDirectory: string) {
    return this.createArchive(async (pack) => {
      await this.addDockerfile(pack, dockerfile);
      await this.addDirectoryTree(pack, rootDirectory);
    });
  }

  createFilesystemTar(rootDirectory: string) {
    return this.createArchive((pack) =>
      this.addDirectoryTree(pack, rootDirectory),
    );
  }

  private createArchive(write: (pack: tar.Pack) => Promise<void>) {
    const pack = tar.pack();
    const archive = Readable.from(pack, { objectMode: false });
    void write(pack)
      .then(() => pack.finalize())
      .catch((error: unknown) =>
        pack.destroy(new Error(getErrorMessage(error))),
      );
    return archive;
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

  private addDockerfile(pack: tar.Pack, dockerfile: string) {
    return new Promise<void>((resolve, reject) => {
      pack.entry(
        { name: 'Dockerfile', mode: 0o644 },
        Buffer.from(dockerfile),
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  private async addDirectoryTree(
    pack: tar.Pack,
    rootDirectory: string,
    relativeDirectory = '',
  ) {
    const entries = await readdir(join(rootDirectory, relativeDirectory));
    entries.sort((left, right) => left.localeCompare(right));
    for (const name of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${name}`
        : name;
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
      await this.addFile(pack, relativePath, absolutePath, fileStat.size, mode);
    }
  }

  private addHeader(pack: tar.Pack, header: Parameters<tar.Pack['entry']>[0]) {
    return new Promise<void>((resolve, reject) => {
      pack.entry(header, (error) => (error ? reject(error) : resolve()));
    });
  }

  private addFile(
    pack: tar.Pack,
    name: string,
    filePath: string,
    size: number,
    mode = 0o644,
  ) {
    const entry = pack.entry({ name, mode, size, type: 'file' });
    return pipeline(createReadStream(filePath), entry);
  }
}
