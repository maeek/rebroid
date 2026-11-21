import { Inject, ConflictException, Injectable } from '@nestjs/common';
import { constants } from 'node:fs';
import {
  access,
  lstat,
  mkdir,
  readdir,
  open,
  rename,
  stat,
} from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  DOCKER_RESOURCE_RUNTIME,
  type DockerResourceRuntimePort,
} from '../../../docker/contracts/docker-resource-runtime.port';
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';
import { ApplicationRuntimeFilesQueryDto } from '../dto/application-runtime-files-query.dto';
import { RuntimeFilePathService } from './runtime-file-path.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';
import { mapWithConcurrency } from '../../../common/map-with-concurrency';
import {
  maximumRuntimeDownloadBytes,
  runtimeDownloadTooLarge,
} from '../utils/runtime-download-limit';

const persistentDownloadRequiredMessage =
  'Temporary profiles can only transfer files while the app is running.';

@Injectable()
export class RuntimeDownloadVolumeService {
  constructor(
    private readonly networkIsolation: NetworkIsolationService,
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly resources: DockerResourceRuntimePort,
    private readonly paths: RuntimeFilePathService,
    private readonly uploads: RuntimeUploadStreamService,
  ) {}

  async listFiles(
    app: AndroidApplication,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const directory = await this.getDirectory(app, query);
    if (!directory) {
      return [];
    }

    let entries: string[];
    try {
      entries = await readdir(directory);
    } catch {
      return [];
    }

    const files = await mapWithConcurrency(entries, 16, async (name) => {
      const safeName = this.paths.sanitizeFileName(name);
      const path = join(directory, safeName);
      const fileStat = await stat(path).catch(() => null);
      if (!fileStat?.isFile()) {
        return null;
      }

      return {
        name: safeName,
        path: `${this.paths.downloadDirectory}/${safeName}`,
        type: 'file' as const,
        sizeBytes: fileStat.size,
        itemCount: null,
        modifiedAt: fileStat.mtime.toISOString(),
      };
    });

    return files
      .filter((file): file is NonNullable<typeof file> => Boolean(file))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async storeStream(
    app: AndroidApplication,
    stream: Readable,
    fileName: string,
    query: ApplicationRuntimeFilesQueryDto,
  ): Promise<ApplicationRuntimeFileUploadDto> {
    const directory = await this.getDirectory(app, query, { create: true });
    if (!directory) {
      stream.resume();
      throw new ConflictException(persistentDownloadRequiredMessage);
    }

    await mkdir(directory, { recursive: true });
    const targetPath = join(directory, fileName);
    const sizeBytes = await this.uploads.withStagedFile(
      stream,
      async (stagedPath, stagedFile) => {
        const previous = await lstat(targetPath).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return undefined;
            throw error;
          },
        );
        if (previous) {
          if (!previous.isFile())
            throw new ConflictException('Download must be a regular file.');
          await access(targetPath, constants.W_OK);
          const staged = await stagedFile.stat();
          if (staged.uid !== previous.uid || staged.gid !== previous.gid) {
            await stagedFile.chown(previous.uid, previous.gid);
          }
          await stagedFile.chmod(previous.mode & 0o777);
        }
        await rename(stagedPath, targetPath);
      },
      { directory, mode: 0o644 },
    );

    return this.uploadResult(fileName, sizeBytes);
  }

  async readFile(
    app: AndroidApplication,
    fileName: string,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const directory = await this.getRequiredDirectory(app, query);

    const file = await open(
      join(directory, fileName),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const info = await file.stat();
      if (!info.isFile())
        throw new ConflictException('Download must be a regular file.');
      if (info.size > maximumRuntimeDownloadBytes)
        throw runtimeDownloadTooLarge();
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of file.createReadStream({
        autoClose: false,
        end: maximumRuntimeDownloadBytes,
      })) {
        const bytes = chunk as Buffer;
        size += bytes.length;
        if (size > maximumRuntimeDownloadBytes) throw runtimeDownloadTooLarge();
        chunks.push(bytes);
      }
      return Buffer.concat(chunks, size);
    } finally {
      await file.close();
    }
  }

  uploadResult(fileName: string, sizeBytes: number) {
    return {
      uploaded: true,
      name: fileName,
      path: `${this.paths.downloadDirectory}/${fileName}`,
      type: 'file' as const,
      sizeBytes,
      itemCount: null,
      modifiedAt: new Date().toISOString(),
    };
  }

  private async getRequiredDirectory(
    app: AndroidApplication,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const directory = await this.getDirectory(app, query);
    if (!directory) {
      throw new ConflictException(persistentDownloadRequiredMessage);
    }

    return directory;
  }

  private async getDirectory(
    app: AndroidApplication,
    query: ApplicationRuntimeFilesQueryDto,
    options: { create?: boolean } = {},
  ) {
    const profileName = this.paths.persistentProfileName(app, query);
    if (!profileName) {
      return null;
    }

    const volumeName = this.networkIsolation.namesFor(
      app.id,
      app.name,
      profileName,
    ).volumeName;

    if (options.create) {
      await this.resources.createVolume(app.id, volumeName);
    }

    const volume = await this.resources.inspectVolume(volumeName);
    if (!volume?.Mountpoint) {
      return null;
    }

    return join(volume.Mountpoint, 'media', '0', 'Download');
  }
}
