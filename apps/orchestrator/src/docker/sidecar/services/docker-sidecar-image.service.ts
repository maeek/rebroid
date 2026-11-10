import { Injectable, Logger } from '@nestjs/common';
import { DockerImageRuntimeService } from '../../images/services/docker-image-runtime.service';
import { DockerSidecarBuildContextService } from './docker-sidecar-build-context.service';

@Injectable()
export class DockerSidecarImageService {
  private readonly logger = new Logger(DockerSidecarImageService.name);

  constructor(
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
    await this.images.buildImage({
      context,
      targetImage: image,
      operationName: 'sidecar_build',
      description: 'Build display sidecar image',
      onProgress: (message, kind) => {
        if (kind !== 'status') {
          this.logger.debug(`[display-sidecar build] ${message}`);
        }
      },
    });
  }
}
