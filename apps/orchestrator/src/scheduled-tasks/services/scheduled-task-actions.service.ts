import { Inject, BadRequestException, Injectable } from '@nestjs/common';
import {
  APK_CATALOG,
  type ApkCatalogPort,
} from '../../apk/contracts/apk-catalog.port';
import {
  ANDROID_APPS_RUNTIME_LOG_MAINTENANCE,
  type AndroidAppsRuntimeLogMaintenancePort,
} from '../../android-apps/contracts/android-apps-runtime-log-maintenance.port';
import {
  DOCKER_PLATFORM_PRUNE,
  type DockerPlatformPrunePort,
} from '../../docker/contracts/docker-platform-prune.port';
import {
  CONTAINER_IMAGE_BUILD_MAINTENANCE,
  type ContainerImageBuildMaintenancePort,
} from '../../container-images/contracts/container-image-build-maintenance.port';
import { ScheduledTaskActionType } from '../entities/scheduled-task.entity';
import { ScheduledTaskActionDto } from '../dto/scheduled-task.dto';
import {
  WORKFLOW_HISTORY_MAINTENANCE,
  type WorkflowHistoryMaintenancePort,
} from '../../automations/contracts/workflow-history-maintenance.port';

type ScheduledTaskPayload = Record<string, unknown> | null | undefined;

const defaultWorkflowHistoryRetentionDays = 7;

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
    @Inject(APK_CATALOG) private readonly apks: ApkCatalogPort,
    @Inject(ANDROID_APPS_RUNTIME_LOG_MAINTENANCE)
    private readonly logs: AndroidAppsRuntimeLogMaintenancePort,
    @Inject(DOCKER_PLATFORM_PRUNE)
    private readonly prune: DockerPlatformPrunePort,
    @Inject(WORKFLOW_HISTORY_MAINTENANCE)
    private readonly workflowHistory: WorkflowHistoryMaintenancePort,
    @Inject(CONTAINER_IMAGE_BUILD_MAINTENANCE)
    private readonly imageBuilds: ContainerImageBuildMaintenancePort,
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
      {
        type: ScheduledTaskActionType.CleanWorkflowHistory,
        label: 'Clean workflow history',
        description:
          'Remove finished workflow runs and their step results and events after the retention period.',
        normalizePayload: (payload) => ({
          retentionDays: integerValue(
            payload,
            'retentionDays',
            defaultWorkflowHistoryRetentionDays,
            1,
            3650,
          ),
        }),
        run: (payload) => {
          const days = integerValue(
            payload,
            'retentionDays',
            defaultWorkflowHistoryRetentionDays,
            1,
            3650,
          );
          return this.workflowHistory.pruneWorkflowHistory(
            new Date(Date.now() - days * 86_400_000),
          );
        },
      },
      {
        type: ScheduledTaskActionType.CleanInterruptedImageBuilds,
        label: 'Clean interrupted image builds',
        description:
          'Remove GApps build staging files older than 24 hours when the build is no longer active.',
        normalizePayload: () => null,
        run: () => this.imageBuilds.cleanInterruptedBuilds(),
      },
      {
        type: ScheduledTaskActionType.CleanImageBuildHistory,
        label: 'Image build history retention',
        description:
          'Remove old completed image builds and their logs while keeping the latest completed build for each target image.',
        normalizePayload: (payload) => ({
          retentionDays: integerValue(payload, 'retentionDays', 30, 1, 3650),
        }),
        run: (payload) => {
          const days = integerValue(payload, 'retentionDays', 30, 1, 3650);
          return this.imageBuilds.pruneBuildHistory(
            new Date(Date.now() - days * 86_400_000),
          );
        },
      },
    ];
  }
}
