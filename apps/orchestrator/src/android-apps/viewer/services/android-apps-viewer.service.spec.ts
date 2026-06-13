import { ConfigService } from '@nestjs/config';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../android-application-status';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
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
      {
        getStored: jest.fn().mockResolvedValue(app),
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

  it('coalesces concurrent viewer bootstrap requests for the same runtime', async () => {
    const app = {
      id: 'app-1',
      containerId: 'container-1',
      containerName: 'runtime-app-1',
      adbPort: 5555,
      scrcpyTransport: 'websocket',
      status: AndroidApplicationStatus.Running,
    } as AndroidApplication;
    let releaseNetworkPreparation!: () => void;
    const networkPreparation = new Promise<void>((resolve) => {
      releaseNetworkPreparation = resolve;
    });
    const ensureNetworkPrepared = jest.fn(async () => {
      await networkPreparation;
      return {
        configured: true,
        connected: true,
        message: 'attached',
        error: null,
      };
    });
    const service = new AndroidAppsViewerService(
      {
        get: () => undefined,
        getOrThrow: () => 'webcodecs',
      } as unknown as ConfigService,
      {
        tryCreateSessionForPreparedTarget: jest.fn().mockResolvedValue(null),
      } as unknown as AndroidAppsDisplaySidecarService,
      {
        getStored: jest.fn().mockResolvedValue(app),
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

    const first = service.scrcpySession(app.id);
    const second = service.scrcpySession(app.id);
    await Promise.resolve();
    releaseNetworkPreparation();

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(ensureNetworkPrepared).toHaveBeenCalledTimes(1);
  });

  it('reuses a recently prepared viewer target for sequential refreshes', async () => {
    const app = {
      id: 'app-1',
      containerId: 'container-1',
      containerName: 'runtime-app-1',
      adbPort: 5555,
      scrcpyTransport: 'websocket',
      status: AndroidApplicationStatus.Running,
    } as AndroidApplication;
    const ensureNetworkPrepared = jest.fn().mockResolvedValue({
      configured: true,
      connected: true,
      message: 'attached',
      error: null,
    });
    const prepareScrcpyAdbTarget = jest.fn().mockResolvedValue({
      configured: true,
      connected: true,
      message: 'device',
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
      {
        getStored: jest.fn().mockResolvedValue(app),
        save: jest.fn().mockResolvedValue(app),
      } as unknown as AndroidAppsStateService,
      {
        ensureNetworkPrepared,
        resolveScrcpyAdbHost: jest.fn().mockResolvedValue('172.20.0.3'),
        prepareScrcpyAdbTarget,
      } as unknown as AndroidAppsViewerNetworkService,
    );

    await service.scrcpySession(app.id);
    await service.scrcpySession(app.id);

    expect(ensureNetworkPrepared).toHaveBeenCalledTimes(1);
    expect(prepareScrcpyAdbTarget).toHaveBeenCalledTimes(1);
  });
});
