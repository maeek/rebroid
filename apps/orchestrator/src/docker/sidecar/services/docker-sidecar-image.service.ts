import { Injectable, Logger } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { DockerEngineService } from '../../docker-engine.service';
import { DockerImageRuntimeService } from '../../images/services/docker-image-runtime.service';
import { DockerSidecarBuildContextService } from './docker-sidecar-build-context.service';

@Injectable()
export class DockerSidecarImageService {
  private readonly logger = new Logger(DockerSidecarImageService.name);

  constructor(
    private readonly engine: DockerEngineService,
    private readonly images: DockerImageRuntimeService,
    private readonly buildContext: DockerSidecarBuildContextService,
  ) {}

  async ensureImage(image: string, buildContextPath: string) {
    if (await this.images.imageExists(image)) {
      return;
    }

    this.logger.log(
      `Building missing display sidecar image ${image} from ${buildContextPath}.`,
    );
    const context = await this.buildContext.createTar(buildContextPath);
    await this.engine.longOperation(
      'sidecar_build',
      'Build display sidecar image',
      async (docker, signal) => {
        const stream = await docker.buildImage(context, {
          t: image,
          abortSignal: signal,
        });
        await new Promise<void>((resolve, reject) => {
          const abort = () =>
            (stream as unknown as Readable).destroy(
              new Error('Display sidecar build aborted.'),
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
              const message =
                event.stream?.trim() || event.errorDetail?.message;
              if (message) {
                this.logger.debug(`[display-sidecar build] ${message}`);
              }
            },
          );
        });
      },
    );
  }
}
