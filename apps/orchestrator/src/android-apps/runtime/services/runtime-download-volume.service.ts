import { runtimeResourceNames } from '../../../network-isolation/runtime-resource-names';
import {
  Inject,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { constants } from 'node:fs';
import { access, lstat, mkdir, readdir, open, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  DOCKER_RESOURCE_RUNTIME,
  type DockerResourceRuntimePort,
} from '../../../docker/contracts/docker-resource-runtime.port';
import { DockerEngineConfigService } from '../../../config/docker-engine-config.service';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';
import {
  downloadDirectory,
  downloadSubdirectories,
} from '../utils/runtime-file-path';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';
import {
  isRuntimeDownloadFileName,
  uploadedRuntimeFile,
} from '../utils/android-apps-runtime-file.utils';
import { mapWithConcurrency } from '../../../common/map-with-concurrency';
import {
  maximumRuntimeDownloadBytes,
  runtimeDownloadTooLarge,
} from '../utils/runtime-download-limit';

const unavailableVolumeMessage =
  'Persistent profile storage is unavailable to the orchestrator.';
const persistentDownloadRequiredMessage =
  'Temporary profiles can only transfer files while the app is running.';

@Injectable()
export class RuntimeDownloadVolumeService {
  constructor(
    private readonly dockerConfig: DockerEngineConfigService,
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly resources: DockerResourceRuntimePort,
    private readonly uploads: RuntimeUploadStreamService,
  ) {}

  async listFiles(app: AndroidApplication, profileName: string | null) {
    const directory = await this.getDirectory(app, profileName);
    if (!directory) {
      return [];
    }

    const names = await readVolumeEntry(readdir(directory));
    const entries = names?.filter(isRuntimeDownloadFileName) ?? [];
    const files = await mapWithConcurrency(entries, 16, async (name) => {
      const fileStat = await readVolumeEntry(lstat(join(directory, name)));
      if (!fileStat?.isFile()) {
        return null;
      }

      return {
        name,
        path: `${downloadDirectory}/${name}`,
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
    profileName: string | null,
  ): Promise<ApplicationRuntimeFileUploadDto> {
    const directory = await this.getDirectory(app, profileName, {
      create: true,
    });
    if (!directory) {
      stream.resume();
      throw new ConflictException(persistentDownloadRequiredMessage);
    }

    const targetPath = join(directory, fileName);
    const sizeBytes = await this.uploads.withStagedFile(
      stream,
      async (stagedPath, stagedFile) => {
        const previous = await readVolumeEntry(lstat(targetPath));
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

    return uploadedRuntimeFile(downloadDirectory, fileName, sizeBytes);
  }

  async readFile(
    app: AndroidApplication,
    fileName: string,
    profileName: string | null,
  ) {
    if (!profileName)
      throw new ConflictException(persistentDownloadRequiredMessage);
    const directory = await this.getDirectory(app, profileName);
    await using file = directory
      ? await readVolumeEntry(
          open(
            join(directory, fileName),
            constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
          ),
        )
      : null;
    if (!file) throw new NotFoundException('Download file was not found.');
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
  }

  private async getDirectory(
    app: AndroidApplication,
    profileName: string | null,
    options: { create?: boolean } = {},
  ) {
    if (!profileName) {
      return null;
    }

    const volumeName = runtimeResourceNames(
      app,
      this.dockerConfig.resourcePrefix,
    ).volumeFor(profileName);

    if (options.create) {
      await this.resources.createVolume(app.id, volumeName);
    }

    const volume = await this.resources.inspectVolume(volumeName);
    if (!volume?.Mountpoint) {
      if (options.create)
        throw new ServiceUnavailableException(unavailableVolumeMessage);
      return null;
    }
    let directory = volume.Mountpoint;
    for (const segment of downloadSubdirectories) {
      directory = join(directory, segment);
      if (options.create) {
        // The engine owns the mountpoint. Create only directories inside it.
        try {
          await mkdir(directory);
          continue;
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw new ServiceUnavailableException(unavailableVolumeMessage, {
              cause,
            });
          }
        }
      }
      const info = await readVolumeEntry(lstat(directory));
      if (!info && !options.create) return null;
      if (!info?.isDirectory())
        throw new ServiceUnavailableException(unavailableVolumeMessage);
    }
    return directory;
  }
}

function readVolumeEntry<T>(operation: Promise<T>) {
  return operation.catch((cause: NodeJS.ErrnoException) => {
    if (cause.code === 'ENOENT') return null;
    throw new ServiceUnavailableException(unavailableVolumeMessage, { cause });
  });
}
