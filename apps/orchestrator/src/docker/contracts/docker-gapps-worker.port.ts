import type { Readable } from 'node:stream';

export const DOCKER_GAPPS_WORKER = Symbol('DOCKER_GAPPS_WORKER');

export interface DockerGappsWorkerRequest {
  image: string;
  jobId: string;
  sourceRepository: string;
  sourceRevision: string;
  signal: AbortSignal;
  onLog: (message: string) => void;
  consumeArchive: (source: Readable, signal: AbortSignal) => Promise<void>;
}

export interface DockerGappsWorkerPort {
  run(request: DockerGappsWorkerRequest): Promise<void>;
}
