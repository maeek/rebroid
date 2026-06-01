import { ConflictException, Injectable } from '@nestjs/common';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import tar from 'tar-stream';
import { shouldIgnoreBuildContextEntry } from '../utils/docker-sidecar.utils';

@Injectable()
export class DockerSidecarBuildContextService {
  async createTar(directory: string) {
    const directoryStat = await stat(directory);
    if (!directoryStat.isDirectory()) {
      throw new ConflictException(
        `Display sidecar build context is not a directory: ${directory}`,
      );
    }

    const pack = tar.pack();
    await this.addDirectory(pack, directory, directory);
    pack.finalize();
    return pack;
  }

  private async addDirectory(
    pack: tar.Pack,
    rootDirectory: string,
    currentDirectory: string,
  ) {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (shouldIgnoreBuildContextEntry(entry.name)) {
        continue;
      }

      const absolutePath = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await this.addDirectory(pack, rootDirectory, absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const content = await readFile(absolutePath);
      const entryStat = await stat(absolutePath);
      const tarPath = relative(rootDirectory, absolutePath)
        .split(sep)
        .join('/');
      await new Promise<void>((resolve, reject) => {
        pack.entry(
          { name: tarPath, mode: entryStat.mode, size: content.length },
          content,
          (error) => (error ? reject(error) : resolve()),
        );
      });
    }
  }
}
