import { PayloadTooLargeException } from '@nestjs/common';
import type { DockerContainerLifecyclePort } from '../../../docker/contracts/docker-container-lifecycle.port';
import type { DockerEnginePort } from '../../../docker/contracts/docker-engine.port';
import type { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import type { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import type { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { applicationLogMaxBytes } from '../../common/utils/application-log-tail';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';
import { AndroidAppsRuntimeDiagnosticsService } from './android-apps-runtime-diagnostics.service';

describe('application log reads', () => {
  const setup = () => {
    const runtime = {
      status: AndroidApplicationStatus.Running,
      containerId: 'container',
    };
    const getBoundedContainerLogs = jest.fn<
      Promise<string>,
      [string, number, number]
    >();
    const read = jest.fn().mockResolvedValue('event');
    const reconcileById = jest.fn();
    const getViewerRuntime = jest.fn().mockResolvedValue(runtime);
    const missing = new Error('Docker container missing');
    const isDockerNotFound = (error: unknown) => error === missing;
    const service = new AndroidAppsRuntimeDiagnosticsService(
      { getBoundedContainerLogs } as unknown as DockerContainerLifecyclePort,
      { read } as unknown as AndroidAppsLogService,
      {} as AndroidAppsSidecarAdbService,
      { reconcileById } as unknown as AndroidAppsRuntimeStateReconciler,
      { getViewerRuntime } as unknown as AndroidAppsQueryService,
      { isDockerNotFound } as unknown as DockerEnginePort,
    );
    return {
      service,
      getBoundedContainerLogs,
      getViewerRuntime,
      read,
      reconcileById,
      missing,
    };
  };

  it('uses storage only for orchestrator events', async () => {
    const {
      service,
      getBoundedContainerLogs,
      getViewerRuntime,
      read,
      reconcileById,
    } = setup();
    await expect(service.eventLogs('app', 5)).resolves.toMatchObject({
      output: 'event',
    });
    expect(getViewerRuntime).toHaveBeenCalledWith('app');
    expect(read).toHaveBeenCalledWith('app', 5);
    expect(reconcileById).not.toHaveBeenCalled();
    expect(getBoundedContainerLogs).not.toHaveBeenCalled();
  });

  it('uses the stored container reference and retries a smaller tail after a byte limit', async () => {
    const { service, getBoundedContainerLogs, reconcileById } = setup();
    getBoundedContainerLogs
      .mockRejectedValueOnce(new PayloadTooLargeException())
      .mockResolvedValue('latest');
    const notice = '[Showing up to 50 lines due to the byte limit.]';
    await expect(service.containerLogs('app', 9000)).resolves.toMatchObject({
      output: `${notice}\nlatest`,
    });
    expect(getBoundedContainerLogs).toHaveBeenNthCalledWith(
      1,
      'container',
      2000,
      applicationLogMaxBytes,
    );
    expect(getBoundedContainerLogs).toHaveBeenNthCalledWith(
      2,
      'container',
      50,
      applicationLogMaxBytes - Buffer.byteLength(notice) - 1,
    );
    expect(reconcileById).not.toHaveBeenCalled();
  });

  it('reports a disappeared container without reconciling the application', async () => {
    const { service, getBoundedContainerLogs, missing, reconcileById } =
      setup();
    getBoundedContainerLogs.mockRejectedValueOnce(missing);
    await expect(service.containerLogs('app')).resolves.toMatchObject({
      output:
        'Container logs are unavailable because the runtime container no longer exists.',
    });
    expect(reconcileById).not.toHaveBeenCalled();
  });
});
