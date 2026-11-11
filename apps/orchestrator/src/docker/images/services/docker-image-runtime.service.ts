import { ConflictException, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { DockerEngineService } from '../../docker-engine.service';
import { managedImageTag } from '../../docker.utils';
import type {
  DockerImageBuildRequest,
  DockerImageRuntimePort,
} from '../../contracts/docker-image-runtime.port';

type DockerImageProgress = {
  stream?: string;
  status?: string;
  progress?: string;
  id?: string;
  error?: string;
  errorDetail?: { message?: string };
};

@Injectable()
export class DockerImageRuntimeService implements DockerImageRuntimePort {
  constructor(private readonly engine: DockerEngineService) {}

  async imageExists(image: string) {
    try {
      await this.inspectImage(image);
      return true;
    } catch (error) {
      if (!this.engine.isDockerNotFound(error)) {
        throw error;
      }
      return false;
    }
  }

  inspectImage(image: string) {
    return this.engine.read(
      () => this.engine.docker.getImage(image).inspect(),
      `Inspect image ${image}`,
    );
  }

  /**
   * Fails fast when a required image is missing instead of starting partial provisioning.
   */
  async ensureImage(image: string) {
    if (await this.imageExists(image)) {
      return;
    }

    throw new ConflictException(
      `Docker image "${image}" is not available locally. Pull it before provisioning.`,
    );
  }

  /**
   * Pulls an image and streams raw progress text to an optional callback.
   */
  async pullImage(image: string, onProgress?: (message: string) => void) {
    await this.engine.longOperation(
      'image_pull',
      `Pull image ${image}`,
      async (docker, signal) => {
        const stream = (await docker.pull(image, {
          abortSignal: signal,
        })) as unknown as Readable;
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            reject(signal.reason);
            stream.destroy();
          };
          if (signal.aborted) {
            abort();
            return;
          }
          signal.addEventListener('abort', abort, { once: true });
          let pullError: Error | undefined;
          docker.modem.followProgress(
            stream,
            (error) => {
              signal.removeEventListener('abort', abort);
              const failure = error ?? pullError;
              if (failure) reject(failure);
              else resolve();
            },
            (event: DockerImageProgress) => {
              const failure = event.errorDetail?.message || event.error;
              if (failure) {
                pullError ??= new Error(failure);
                return;
              }
              if (!onProgress) {
                return;
              }

              const parts = [event.status, event.progress, event.id].filter(
                Boolean,
              );
              onProgress(parts.join(' '));
            },
          );
        });
      },
    );
    await this.markPulledImageAsManaged(image);
  }

  async buildImage(request: DockerImageBuildRequest): Promise<void> {
    try {
      request.signal?.throwIfAborted();
      await this.engine.longOperation(
        request.operationName,
        request.description,
        async (docker, operationSignal) => {
          const signal = request.signal
            ? AbortSignal.any([operationSignal, request.signal])
            : operationSignal;
          signal.throwIfAborted();
          const stream = (await docker.buildImage(request.context, {
            t: request.targetImage,
            abortSignal: signal,
          })) as unknown as Readable;

          let abort: (() => void) | undefined;
          try {
            await new Promise<void>((resolve, reject) => {
              abort = () => {
                reject(signal.reason);
                stream.destroy();
              };
              if (signal.aborted) {
                abort();
                return;
              }
              signal.addEventListener('abort', abort, { once: true });

              let buildError: Error | undefined;
              docker.modem.followProgress(
                stream,
                (error) => {
                  const failure = error ?? buildError;
                  if (failure) reject(failure);
                  else resolve();
                },
                (event: DockerImageProgress) => {
                  const failure = event.errorDetail?.message || event.error;
                  if (failure) {
                    buildError ??= new Error(failure);
                    request.onProgress?.(failure, 'error');
                    return;
                  }
                  const output = event.stream?.trim();
                  if (output) {
                    request.onProgress?.(output, 'output');
                    return;
                  }
                  const status = [event.id, event.status, event.progress]
                    .filter(Boolean)
                    .join(' ');
                  if (status) request.onProgress?.(status, 'status');
                },
              );
            });
          } finally {
            if (abort) signal.removeEventListener('abort', abort);
          }
        },
        request.timeoutMs,
      );
    } finally {
      request.context.destroy();
    }
  }

  private async markPulledImageAsManaged(image: string) {
    const inspect = await this.engine.read(
      () => this.engine.docker.getImage(image).inspect(),
      `Inspect pulled image ${image}`,
    );
    const [repo, tag] = managedImageTag(inspect.Id).split(':');
    await this.engine.mutate(
      () => this.engine.docker.getImage(inspect.Id).tag({ repo, tag }),
      `Mark pulled image ${inspect.Id} as managed`,
    );
  }

  async listImages() {
    return this.engine.read(
      () => this.engine.docker.listImages(),
      'List images',
    );
  }

  async removeImage(image: string, force = false) {
    return this.engine.mutate(
      () => this.engine.docker.getImage(image).remove({ force }),
      `Remove image ${image}`,
    );
  }
}
