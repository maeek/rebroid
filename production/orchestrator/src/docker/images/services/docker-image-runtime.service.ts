import { ConflictException, Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';

@Injectable()
export class DockerImageRuntimeService {
  constructor(private readonly engine: DockerEngineService) {}

  async imageExists(image: string) {
    try {
      await this.engine.docker.getImage(image).inspect();
      return true;
    } catch {
      return false;
    }
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
    const stream = await this.engine.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      this.engine.docker.modem.followProgress(
        stream,
        (error) => {
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
  }

  async listImages() {
    return this.engine.docker.listImages();
  }

  async removeImage(image: string, force = false) {
    return this.engine.docker.getImage(image).remove({ force });
  }
}
