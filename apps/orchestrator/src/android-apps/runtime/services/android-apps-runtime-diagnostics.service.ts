import { Inject, Injectable } from '@nestjs/common';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';

@Injectable()
export class AndroidAppsRuntimeDiagnosticsService {
  constructor(
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    private readonly logs: AndroidAppsLogService,
    private readonly sidecarAdb: AndroidAppsSidecarAdbService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
  ) {}

  async notifications(id: string) {
    const app = await this.reconciler.reconcileById(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      return [];
    }

    return this.sidecarAdb.notifications(app);
  }

  async containerLogs(id: string, tail = 300) {
    const app = await this.reconciler.reconcileById(id);
    if (!app.containerId) {
      return {
        source: 'container' as const,
        collectedAt: new Date().toISOString(),
        output: 'No container has been created for this application yet.',
      };
    }

    const runtimeState = await this.lifecycle.getContainerRuntimeState(
      app.containerId,
    );
    if (!runtimeState.exists) {
      return {
        source: 'container' as const,
        collectedAt: new Date().toISOString(),
        output:
          app.status === AndroidApplicationStatus.Stopped
            ? 'Container logs are unavailable because the runtime container is currently stopped and has already been removed.'
            : 'Container logs are unavailable because the runtime container no longer exists.',
      };
    }

    return {
      source: 'container' as const,
      collectedAt: new Date().toISOString(),
      output: await this.lifecycle.getContainerLogs(app.containerId, tail),
    };
  }

  async eventLogs(id: string, tail = 300) {
    await this.reconciler.reconcileById(id);
    return {
      source: 'orchestrator' as const,
      collectedAt: new Date().toISOString(),
      output: await this.logs.read(id, tail),
    };
  }

  async adbLogs(id: string, tail = 300) {
    const app = await this.reconciler.reconcileById(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      return {
        source: 'adb' as const,
        collectedAt: new Date().toISOString(),
        output:
          'ADB logs are available after the Android container is running.',
      };
    }

    return this.sidecarAdb.logcat(app, tail);
  }
}
