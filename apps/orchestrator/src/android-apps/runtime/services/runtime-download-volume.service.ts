import { ConflictException, Injectable } from '@nestjs/common';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DockerResourceRuntimeService } from '../../../docker/resources/services/docker-resource-runtime.service';
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';
import { ApplicationRuntimeFilesQueryDto } from '../dto/application-runtime-files-query.dto';
import { RuntimeFilePathService } from './runtime-file-path.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';

const persistentDownloadRequiredMessage =
  'Temporary profiles can only transfer files while the app is running.';

@Injectable()
export class RuntimeDownloadVolumeService {
  constructor(
    private readonly networkIsolation: NetworkIsolationService,
    private readonly resources: DockerResourceRuntimeService,
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

    const files = await Promise.all(
      entries.map(async (name) => {
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
      }),
    );

    return files
      .filter((file): file is NonNullable<typeof file> => Boolean(file))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async storeBuffer(
    app: AndroidApplication,
    fileName: string,
    buffer: Buffer,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const directory = await this.getRequiredDirectory(app, query, {
      create: true,
    });

    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, fileName), buffer, { mode: 0o644 });
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
    let sizeBytes = 0;
    const counter = this.uploads.createByteCounter((bytes) => {
      sizeBytes += bytes;
    });

    try {
      await pipeline(
        stream,
        counter,
        createWriteStream(targetPath, { mode: 0o644 }),
      );
    } catch (error) {
      await unlink(targetPath).catch(() => undefined);
      throw error;
    }

    return this.uploadResult(fileName, sizeBytes);
  }

  async readFile(
    app: AndroidApplication,
    fileName: string,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const directory = await this.getRequiredDirectory(app, query);

    return readFile(join(directory, fileName));
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
    options: { create?: boolean } = {},
  ) {
    const directory = await this.getDirectory(app, query, options);
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
