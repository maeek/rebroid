import { Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../../docker/contracts/docker-engine.port';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import {
  applicationLogMaxBytes,
  normalizeApplicationLogTail,
} from '../../common/utils/application-log-tail';
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
    private readonly queries: AndroidAppsQueryService,
    @Inject(DOCKER_ENGINE) private readonly engine: DockerEnginePort,
  ) {}

  async containerLogs(id: string, tail = 300) {
    const app = await this.queries.getViewerRuntime(id);
    const unavailable =
      app.status === AndroidApplicationStatus.Stopped
        ? 'Container logs are unavailable because the runtime container is currently stopped and has already been removed.'
        : 'Container logs are unavailable because the runtime container no longer exists.';
    let output = 'No container has been created for this application yet.';
    if (app.containerId) {
      const containerId = app.containerId;
      const lines = normalizeApplicationLogTail(tail);
      const read = (limit: number, maxBytes = applicationLogMaxBytes) =>
        this.lifecycle.getBoundedContainerLogs(containerId, limit, maxBytes);
      try {
        output = await read(lines).catch(async (error: unknown) => {
          if (error instanceof PayloadTooLargeException && lines > 50) {
            const notice = '[Showing up to 50 lines due to the byte limit.]';
            const logs = await read(
              50,
              applicationLogMaxBytes - Buffer.byteLength(notice) - 1,
            );
            return logs ? `${notice}\n${logs}` : notice;
          }
          throw error;
        });
      } catch (error) {
        if (this.engine.isDockerNotFound(error)) output = unavailable;
        else if (error instanceof PayloadTooLargeException)
          output =
            'The container log tail exceeds the byte limit. Request fewer lines.';
        else throw error;
      }
    }
    return {
      source: 'container' as const,
      collectedAt: new Date().toISOString(),
      output,
    };
  }

  async eventLogs(id: string, tail = 300) {
    await this.queries.getViewerRuntime(id);
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

    return this.sidecarAdb.logcat(app, normalizeApplicationLogTail(tail));
  }
}
