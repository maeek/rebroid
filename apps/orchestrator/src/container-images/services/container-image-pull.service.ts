import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { resolveContainerImage } from '../../common/container-image-reference';
import {
  DOCKER_IMAGE_RUNTIME,
  type DockerImageRuntimePort,
} from '../../docker/contracts/docker-image-runtime.port';
import { SettingsService } from '../../settings/settings.service';
import type { ContainerImagePullJobDto } from '../dto/container-image-pull-job.dto';

const maxActivePulls = 32;
const maxFinishedPulls = 128;

type ActivePull = {
  job: ContainerImagePullJobDto;
  completion: Promise<void>;
};

@Injectable()
export class ContainerImagePullService {
  private readonly logger = new Logger(ContainerImagePullService.name);
  private readonly active = new Map<string, ActivePull>();
  private readonly finished = new Map<string, ContainerImagePullJobDto>();

  constructor(
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    private readonly settings: SettingsService,
  ) {}

  async pull(reference: string) {
    const image = await this.resolveImage(reference);
    await this.admit(image).completion;
    return { image, status: 'pulled' as const };
  }

  async start(reference: string): Promise<ContainerImagePullJobDto> {
    return { ...this.admit(await this.resolveImage(reference)).job };
  }

  private admit(image: string): ActivePull {
    const existing = [...this.active.values()].find(
      ({ job }) => job.image === image,
    );
    if (existing) return existing;
    if (this.active.size >= maxActivePulls) {
      throw new ServiceUnavailableException('Too many image pulls are active.');
    }

    const job: ContainerImagePullJobDto = {
      id: randomUUID(),
      image,
      phase: 'queued',
    };
    const completion = Promise.resolve().then(() => this.run(job));
    void completion.catch(() => undefined);
    const active = { job, completion };
    this.active.set(job.id, active);
    return active;
  }

  get(id: string) {
    const job = this.active.get(id)?.job ?? this.finished.get(id);
    if (!job) throw new NotFoundException('Image pull job was not found.');
    return { ...job };
  }

  private async resolveImage(reference: string) {
    const settings = await this.settings.getSettings();
    return resolveContainerImage(reference, settings.dockerImageRegistry);
  }

  private async run(job: ContainerImagePullJobDto) {
    try {
      await this.images.pullImage(job.image, undefined, (phase) => {
        job.phase = phase;
      });
      job.phase = 'pulled';
    } catch (error) {
      job.phase = 'failed';
      this.logger.warn(
        `Image pull ${job.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      this.finished.set(job.id, job);
      this.active.delete(job.id);
      if (this.finished.size > maxFinishedPulls) {
        const oldest = this.finished.keys().next();
        if (!oldest.done) this.finished.delete(oldest.value);
      }
    }
  }
}
