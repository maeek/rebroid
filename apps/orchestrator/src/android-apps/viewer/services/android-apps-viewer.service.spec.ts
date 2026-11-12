import { ConfigService } from '@nestjs/config';
import type { AndroidApplication } from '../../android-application.entity';
import type { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import type { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
import type { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';
import { AndroidAppsViewerService } from './android-apps-viewer.service';

const app = {
  id: 'app-1',
  containerId: 'container-1',
  containerName: 'runtime-app-1',
  adbPort: 5555,
  scrcpyTransport: 'websocket',
  status: AndroidApplicationStatus.Running,
} as AndroidApplication;

const target = {
  adbHost: '172.20.0.3',
  udid: '172.20.0.3:5555',
  key: 'target',
  viewerTarget: {
    configured: true,
    connected: true,
    message: 'device',
    error: null,
  },
};

function setup() {
  const network = {
    prepareViewerTarget: jest.fn().mockResolvedValue(target),
    invalidateViewerTarget: jest.fn(),
  };
  const sidecar = {
    tryCreateSessionForPreparedTarget: jest
      .fn()
      .mockResolvedValue({ id: 'display-session-1' }),
  };
  const viewer = new AndroidAppsViewerService(
    new ConfigService({ app: { displaySidecar: { player: 'webcodecs' } } }),
    sidecar as unknown as AndroidAppsDisplaySidecarService,
    {
      getStored: jest.fn().mockResolvedValue(app),
    } as unknown as AndroidAppsQueryService,
    {
      recordViewerActivity: jest.fn().mockResolvedValue(new Date()),
    } as unknown as AndroidAppsStateWriter,
    network as unknown as AndroidAppsViewerNetworkService,
  );
  return { viewer, network, sidecar };
}

describe('AndroidAppsViewerService', () => {
  it('retries a transient preparation error during viewer bootstrap', async () => {
    const { viewer, network } = setup();
    network.prepareViewerTarget.mockRejectedValueOnce(
      new Error('socket hang up'),
    );

    await expect(viewer.scrcpySession(app.id)).resolves.toMatchObject({
      viewerTargetConnected: true,
      adbHost: target.adbHost,
    });
    expect(network.prepareViewerTarget).toHaveBeenCalledTimes(2);
  });

  it('invalidates the prepared target when the display session cannot be minted', async () => {
    const { viewer, network, sidecar } = setup();
    sidecar.tryCreateSessionForPreparedTarget.mockResolvedValueOnce(null);
    await viewer.scrcpySession(app.id);
    expect(network.invalidateViewerTarget).toHaveBeenCalledWith(target);
  });
});
