import { ConfigService } from '@nestjs/config';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';
import { AndroidAppsViewerService } from './android-apps-viewer.service';
import type { DisplaySessionDto } from '../dto/scrcpy-session.dto';

const displaySession = (
  overrides: Partial<DisplaySessionDto> = {},
): DisplaySessionDto => ({
  id: 'display-session-1',
  appId: 'app-1',
  surfaceId: 'main',
  surfaceKind: 'main',
  displayName: 'Main display',
  status: 'active',
  createdAt: '2026-06-13T22:23:50.000Z',
  lastActivityAt: '2026-06-13T22:23:50.000Z',
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  maxExpiresAt: new Date(Date.now() + 600_000).toISOString(),
  capabilities: ['video', 'audio'],
  surface: {
    id: 'main',
    sessionId: 'display-session-1',
    kind: 'main',
    name: 'Main display',
    status: 'active',
    createdAt: '2026-06-13T22:23:50.000Z',
    lastActivityAt: '2026-06-13T22:23:50.000Z',
    streamPath: '/rebroid/display/stream?sessionId=display-session-1',
    viewerPath: '/viewer/display?sessionId=display-session-1',
    webrtcOfferPath:
      '/rebroid/display/public/sessions/display-session-1/webrtc/offer',
  },
  surfaces: [],
  streamPath: '/rebroid/display/stream?sessionId=display-session-1',
  viewerPath: '/viewer/display?sessionId=display-session-1',
  webrtcOfferPath:
    '/rebroid/display/public/sessions/display-session-1/webrtc/offer',
  ...overrides,
});

const logs = () =>
  ({
    append: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AndroidAppsLogService;

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
      logs(),
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
      logs(),
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

  it('reuses a prepared viewer target while the display session remains valid', async () => {
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
        tryCreateSessionForPreparedTarget: jest
          .fn()
          .mockResolvedValue(displaySession()),
      } as unknown as AndroidAppsDisplaySidecarService,
      logs(),
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

  it('invalidates the prepared target cache when display session reuse fails', async () => {
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
        tryCreateSessionForPreparedTarget: jest
          .fn()
          .mockResolvedValueOnce(displaySession())
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(displaySession({ id: 'display-session-2' })),
      } as unknown as AndroidAppsDisplaySidecarService,
      logs(),
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
    await service.scrcpySession(app.id);

    expect(ensureNetworkPrepared).toHaveBeenCalledTimes(2);
    expect(prepareScrcpyAdbTarget).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a prepared viewer target after the runtime container changes', async () => {
    const firstApp = {
      id: 'app-1',
      containerId: 'container-1',
      containerName: 'runtime-app-1',
      adbPort: 5555,
      scrcpyTransport: 'websocket',
      status: AndroidApplicationStatus.Running,
    } as AndroidApplication;
    const secondApp = {
      ...firstApp,
      containerId: 'container-2',
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
        tryCreateSessionForPreparedTarget: jest
          .fn()
          .mockResolvedValue(displaySession()),
      } as unknown as AndroidAppsDisplaySidecarService,
      logs(),
      {
        getStored: jest
          .fn()
          .mockResolvedValueOnce(firstApp)
          .mockResolvedValueOnce(secondApp),
        save: jest.fn().mockResolvedValue(firstApp),
      } as unknown as AndroidAppsStateService,
      {
        ensureNetworkPrepared,
        resolveScrcpyAdbHost: jest.fn().mockResolvedValue('172.20.0.3'),
        prepareScrcpyAdbTarget,
      } as unknown as AndroidAppsViewerNetworkService,
    );

    await service.scrcpySession(firstApp.id);
    await service.scrcpySession(firstApp.id);

    expect(ensureNetworkPrepared).toHaveBeenCalledTimes(2);
    expect(prepareScrcpyAdbTarget).toHaveBeenCalledTimes(2);
  });
});
