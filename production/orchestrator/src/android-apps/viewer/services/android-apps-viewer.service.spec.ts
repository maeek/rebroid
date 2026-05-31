import { ConfigService } from '@nestjs/config';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../android-application-status';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from './android-apps-sidecar-adb.service';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';
import { AndroidAppsViewerService } from './android-apps-viewer.service';

describe('AndroidAppsViewerService', () => {
  it('retries a transient sidecar network attachment failure during viewer bootstrap', async () => {
    const app = {
      id: 'app-1',
      containerId: 'container-1',
      containerName: 'runtime-app-1',
      adbPort: 5555,
      scrcpyTransport: 'websocket',
      status: AndroidApplicationStatus.Running,
    } as AndroidApplication;
    const ensureNetworkPrepared = jest
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValue({
        configured: true,
        connected: true,
        message: 'attached',
        error: null,
      });
    const service = new AndroidAppsViewerService(
      {
        get: () => undefined,
        getOrThrow: () => 'webcodecs',
      } as unknown as ConfigService,
      {
        tryCreateSessionForPreparedTarget: jest.fn().mockResolvedValue(null),
      } as unknown as AndroidAppsDisplaySidecarService,
      {} as AndroidAppsSidecarAdbService,
      {
        get: jest.fn().mockResolvedValue(app),
        save: jest.fn().mockResolvedValue(app),
      } as unknown as AndroidAppsStateService,
      {
        ensureNetworkPrepared,
        resolveScrcpyAdbHost: jest.fn().mockResolvedValue('172.20.0.3'),
        prepareScrcpyAdbTarget: jest.fn().mockResolvedValue({
          configured: true,
          connected: true,
          message: 'device',
          error: null,
        }),
      } as unknown as AndroidAppsViewerNetworkService,
    );

    await expect(service.scrcpySession(app.id)).resolves.toMatchObject({
      viewerTargetConnected: true,
      adbHost: '172.20.0.3',
    });
    expect(ensureNetworkPrepared).toHaveBeenCalledTimes(2);
  });
});
