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
  normalizePayload?: (
    payload: ScheduledTaskPayload,
  ) => Record<string, unknown> | null;
  run: (payload: Record<string, unknown> | null) => Promise<unknown>;
};

const danglingOnly = (payload: ScheduledTaskPayload) => {
  const value = payload?.danglingOnly ?? true;
  if (typeof value !== 'boolean')
    throw new BadRequestException('danglingOnly must be a boolean.');
  return value;
};

function withRetention(
  defaultDays: number,
  cleanup: (days: number) => Promise<unknown>,
) {
  const daysFor = (payload: ScheduledTaskPayload) => {
    const value = payload?.retentionDays;
    if (value == null || value === '') return defaultDays;
    const days = typeof value === 'string' ? Number(value) : value;
    if (
      typeof days !== 'number' ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 3650
    )
      throw new BadRequestException(
        'retentionDays must be an integer between 1 and 3650.',
      );
    return days;
  };
  return {
    normalizePayload: (payload: ScheduledTaskPayload) => ({
      retentionDays: daysFor(payload),
    }),
    run: (payload: ScheduledTaskPayload) => cleanup(daysFor(payload)),
  };
}

const cutoffDaysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000);

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
    return this.definitions.map(({ type, label, description }) => ({
      type,
      label,
      description,
    }));
  }

  normalizePayload(
    type: ScheduledTaskActionType,
    payload: ScheduledTaskPayload,
  ) {
    return this.getDefinition(type).normalizePayload?.(payload) ?? null;
  }

  run(type: ScheduledTaskActionType, payload: Record<string, unknown> | null) {
    return this.getDefinition(type).run(payload);
  }

  private getDefinition(type: ScheduledTaskActionType) {
    const definition = this.definitions.find((item) => item.type === type);
    if (!definition) {
      throw new BadRequestException(
        `Unsupported scheduled task action: ${type}`,
      );
    }
    return definition;
  }

  private readonly definitions: ScheduledTaskActionDefinition[] = [
    {
      type: ScheduledTaskActionType.CleanOrphanedApkFiles,
      label: 'Clean orphaned APK files',
      description:
        'Remove incomplete transfers and APK files without upload records.',
      run: () => this.apks.cleanupOrphanedFiles(),
    },
    {
      type: ScheduledTaskActionType.PruneImages,
      label: 'Prune images',
      description: 'Remove dangling or unused Docker images.',
      normalizePayload: (payload) => ({ danglingOnly: danglingOnly(payload) }),
      run: (payload) => this.prune.pruneImages(danglingOnly(payload)),
    },
    {
      type: ScheduledTaskActionType.PruneContainers,
      label: 'Prune containers',
      description: 'Remove stopped Docker containers.',
      run: () => this.prune.pruneContainers(),
    },
    {
      type: ScheduledTaskActionType.PruneNetworks,
      label: 'Prune networks',
      description: 'Remove unused Docker networks.',
      run: () => this.prune.pruneNetworks(),
    },
    {
      type: ScheduledTaskActionType.PruneVolumes,
      label: 'Prune volumes',
      description: 'Remove unused Docker volumes.',
      run: () => this.prune.pruneVolumes(),
    },
    {
      type: ScheduledTaskActionType.PruneAll,
      label: 'Full cleanup',
      description:
        'Prune stopped containers, unused networks, dangling images, and unused volumes.',
      run: () => this.prune.pruneAll(),
    },
    {
      type: ScheduledTaskActionType.CleanRuntimeLogs,
      label: 'Clean runtime logs',
      description: 'Remove old orchestrator runtime log files.',
      ...withRetention(30, (days) => this.logs.cleanup(days)),
    },
    {
      type: ScheduledTaskActionType.CleanWorkflowHistory,
      label: 'Clean workflow history',
      description:
        'Remove finished workflow runs and their step results and events after the retention period.',
      ...withRetention(defaultWorkflowHistoryRetentionDays, (days) =>
        this.workflowHistory.pruneWorkflowHistory(cutoffDaysAgo(days)),
      ),
    },
    {
      type: ScheduledTaskActionType.CleanInterruptedImageBuilds,
      label: 'Clean interrupted image builds',
      description:
        'Remove GApps build staging files older than 24 hours when the build is no longer active.',
      run: () => this.imageBuilds.cleanInterruptedBuilds(),
    },
    {
      type: ScheduledTaskActionType.CleanImageBuildHistory,
      label: 'Image build history retention',
      description:
        'Remove old completed image builds and their logs while keeping the latest completed build for each target image.',
      ...withRetention(30, (days) =>
        this.imageBuilds.pruneBuildHistory(cutoffDaysAgo(days)),
      ),
    },
  ];
}
