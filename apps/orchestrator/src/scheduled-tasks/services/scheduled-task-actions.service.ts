import { BadRequestException, Injectable } from '@nestjs/common';
import { ApkCatalogService } from '../../apk/services/apk-catalog.service';
import { AndroidAppsLogService } from '../../android-apps/common/services/android-apps-log.service';
import { DockerPlatformPruneService } from '../../docker/prune/services/docker-platform-prune.service';
import { ScheduledTaskActionType } from '../entities/scheduled-task.entity';
import { ScheduledTaskActionDto } from '../dto/scheduled-task.dto';

type ScheduledTaskPayload = Record<string, unknown> | null | undefined;

type ScheduledTaskActionDefinition = ScheduledTaskActionDto & {
  normalizePayload: (
    payload: ScheduledTaskPayload,
  ) => Record<string, unknown> | null;
  run: (payload: Record<string, unknown> | null) => Promise<unknown>;
};

const booleanValue = (
  payload: ScheduledTaskPayload,
  key: string,
  fallback: boolean,
) => {
  const value = payload?.[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${key} must be a boolean.`);
  }
  return value;
};

const integerValue = (
  payload: ScheduledTaskPayload,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  const value = payload?.[key];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new BadRequestException(
      `${key} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
};

@Injectable()
export class ScheduledTaskActionsService {
  constructor(
    private readonly apks: ApkCatalogService,
    private readonly logs: AndroidAppsLogService,
    private readonly prune: DockerPlatformPruneService,
  ) {}

  listActions(): ScheduledTaskActionDto[] {
    return this.definitions().map(({ type, label, description }) => ({
      type,
      label,
      description,
    }));
  }

  normalizePayload(
    type: ScheduledTaskActionType,
    payload: ScheduledTaskPayload,
  ) {
    return this.getDefinition(type).normalizePayload(payload);
  }

  run(type: ScheduledTaskActionType, payload: Record<string, unknown> | null) {
    return this.getDefinition(type).run(payload);
  }

  private getDefinition(type: ScheduledTaskActionType) {
    const definition = this.definitions().find((item) => item.type === type);
    if (!definition) {
      throw new BadRequestException(
        `Unsupported scheduled task action: ${type}`,
      );
    }
    return definition;
  }

  private definitions(): ScheduledTaskActionDefinition[] {
    return [
      {
        type: ScheduledTaskActionType.CleanUploadedApks,
        label: 'Clean APK uploads',
        description:
          'Remove uploaded APK records and files that are not referenced by any application.',
        normalizePayload: () => null,
        run: () => this.apks.cleanupUnused(),
      },
      {
        type: ScheduledTaskActionType.PruneImages,
        label: 'Prune images',
        description: 'Remove dangling or unused Docker images.',
        normalizePayload: (payload) => ({
          danglingOnly: booleanValue(payload, 'danglingOnly', true),
        }),
        run: (payload) =>
          this.prune.pruneImages(Boolean(payload?.danglingOnly ?? true)),
      },
      {
        type: ScheduledTaskActionType.PruneContainers,
        label: 'Prune containers',
        description: 'Remove stopped Docker containers.',
        normalizePayload: () => null,
        run: () => this.prune.pruneContainers(),
      },
      {
        type: ScheduledTaskActionType.PruneNetworks,
        label: 'Prune networks',
        description: 'Remove unused Docker networks.',
        normalizePayload: () => null,
        run: () => this.prune.pruneNetworks(),
      },
      {
        type: ScheduledTaskActionType.PruneVolumes,
        label: 'Prune volumes',
        description: 'Remove unused Docker volumes.',
        normalizePayload: () => null,
        run: () => this.prune.pruneVolumes(),
      },
      {
        type: ScheduledTaskActionType.PruneAll,
        label: 'Full cleanup',
        description:
          'Prune stopped containers, unused networks, dangling images, and unused volumes.',
        normalizePayload: () => null,
        run: async () => ({
          containers: await this.prune.pruneContainers(),
          networks: await this.prune.pruneNetworks(),
          images: await this.prune.pruneImages(true),
          volumes: await this.prune.pruneVolumes(),
        }),
      },
      {
        type: ScheduledTaskActionType.CleanRuntimeLogs,
        label: 'Clean runtime logs',
        description: 'Remove old orchestrator runtime log files.',
        normalizePayload: (payload) => ({
          retentionDays: integerValue(payload, 'retentionDays', 30, 1, 3650),
        }),
        run: (payload) =>
          this.logs.cleanup(Number(payload?.retentionDays ?? 30)),
      },
    ];
  }
}
