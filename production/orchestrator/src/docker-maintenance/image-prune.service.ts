import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DockerService } from '../docker/docker.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ImagePruneService {
  private readonly logger = new Logger(ImagePruneService.name);
  private lastPrunedAt: Date | null = null;

  constructor(
    private readonly docker: DockerService,
    private readonly settings: SettingsService,
  ) {}

  @Interval(60_000)
  async pruneOnSchedule() {
    const settings = await this.settings.getSettings();
    if (settings.imagePruneIntervalHours <= 0) {
      return;
    }

    const dueAt =
      (this.lastPrunedAt?.getTime() ?? 0) + settings.imagePruneIntervalHours * 60 * 60 * 1000;
    if (Date.now() < dueAt) {
      return;
    }

    this.lastPrunedAt = new Date();
    try {
      await this.docker.pruneImages(settings.imagePruneDanglingOnly);
      this.logger.log('Scheduled image prune completed.');
    } catch (error) {
      this.logger.error(error);
    }
  }
}
