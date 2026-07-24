import type { Readable } from 'node:stream';

export const DOCKER_CONTAINER_ARCHIVE = Symbol('DOCKER_CONTAINER_ARCHIVE');

export class DockerContainerArchiveReadLimitError extends Error {
  constructor(readonly maximumBytes: number) {
    super(`Container archive entry exceeds ${maximumBytes} bytes.`);
    this.name = 'DockerContainerArchiveReadLimitError';
  }
}

export interface DockerContainerArchivePort {
  copyFileToContainer(
    containerId: string,
    sourcePath: string,
    targetDirectory: string,
    targetFileName?: string,
  ): Promise<void>;
  copyBufferToContainer(
    containerId: string,
    content: Buffer,
    targetDirectory: string,
    targetFileName: string,
  ): Promise<void>;
  copyStreamToContainer(
    containerId: string,
    content: Readable,
    targetDirectory: string,
    targetFileName: string,
    size?: number,
  ): Promise<void>;
  readFileFromContainer(
    containerId: string,
    containerPath: string,
    options?: { maximumBytes?: number },
  ): Promise<Buffer>;
}
