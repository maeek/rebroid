import { ConflictException, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { DockerEngineService } from '../../docker-engine.service';
import { managedImageTag } from '../../docker.utils';
import type { DockerImageRuntimePort } from '../../contracts/docker-image-runtime.port';

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
        const stream = await docker.pull(image, { abortSignal: signal });
        await new Promise<void>((resolve, reject) => {
          const abort = () =>
            (stream as unknown as Readable).destroy(
              new Error(`Pull image ${image} aborted.`),
            );
          signal.addEventListener('abort', abort, { once: true });
          docker.modem.followProgress(
            stream,
            (error) => {
              signal.removeEventListener('abort', abort);
              if (error) {
                reject(error);
                return;
              }

              resolve();
            },
            (event) => {
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
