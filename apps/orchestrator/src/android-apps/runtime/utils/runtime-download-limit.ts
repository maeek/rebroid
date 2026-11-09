import { PayloadTooLargeException } from '@nestjs/common';
import {
  DockerContainerArchiveReadLimitError,
  type DockerContainerArchivePort,
} from '../../../docker/contracts/docker-container-archive.port';

// The download DTO embeds base64 and is buffered by both services.
export const maximumRuntimeDownloadBytes = 25 * 1024 * 1024;

export const runtimeDownloadTooLarge = () =>
  new PayloadTooLargeException('File downloads are limited to 25 MiB.');

export const readRuntimeDownload = async (
  archive: DockerContainerArchivePort,
  containerId: string,
  path: string,
) => {
  try {
    return await archive.readFileFromContainer(containerId, path, {
      maximumBytes: maximumRuntimeDownloadBytes,
    });
  } catch (error) {
    if (error instanceof DockerContainerArchiveReadLimitError) {
      throw runtimeDownloadTooLarge();
    }
    throw error;
  }
};
