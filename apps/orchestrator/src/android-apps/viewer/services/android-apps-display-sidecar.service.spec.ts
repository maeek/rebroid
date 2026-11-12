import { ConfigService } from '@nestjs/config';
import type { AndroidApplication } from '../../android-application.entity';
import type { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import { AndroidAppsDisplaySidecarService } from './android-apps-display-sidecar.service';
import type { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';

describe('AndroidAppsDisplaySidecarService viewer control', () => {
  const app = { id: 'app-1', adbPort: 5555 } as AndroidApplication;
  const session = { id: 'session-1', appId: app.id };
  const actionUrl =
    'http://sidecar.test/rebroid/display/sessions/session-1/actions';
  let fetchDisplay: jest.SpyInstance;
  let service: AndroidAppsDisplaySidecarService;

  beforeEach(() => {
    const config = new ConfigService({
      app: { displaySidecar: { internalBaseUrl: 'http://sidecar.test' } },
    });
    const network = {
      prepareNetwork: jest.fn(),
      resolveScrcpyAdbHost: jest.fn().mockResolvedValue('10.0.0.2'),
      prepareScrcpyAdbTarget: jest
        .fn()
        .mockResolvedValue({ configured: true, connected: true }),
    } as unknown as AndroidAppsViewerNetworkService;
    service = new AndroidAppsDisplaySidecarService(
      config,
      network,
      {} as FeatureFlagsService,
      { synchronizeFeatures: jest.fn() },
    );
    fetchDisplay = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ session }, { status: 201 }));
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['stream-control', 'adb'])(
    'accepts a Home acknowledgment over %s without a second session object',
    async (transport) => {
      fetchDisplay.mockResolvedValueOnce(
        Response.json(
          { ok: true, command: 'home', executed: true, transport },
          { status: 201 },
        ),
      );

      await expect(service.viewerControl(app, 'home')).resolves.toEqual({
        session,
        command: 'home',
        executed: true,
      });
      expect(fetchDisplay).toHaveBeenNthCalledWith(
        2,
        actionUrl,
        expect.objectContaining({ method: 'POST', body: '{"command":"home"}' }),
      );
      expect(fetchDisplay).toHaveBeenCalledTimes(2);
    },
  );

  it('rejects a response without a positive execution acknowledgment', async () => {
    fetchDisplay.mockResolvedValueOnce(
      Response.json({ ok: true, session, command: 'home', executed: false }),
    );

    await expect(service.viewerControl(app, 'home')).rejects.toMatchObject({
      response: { code: 'control_outcome_unknown' },
    });
    expect(fetchDisplay).toHaveBeenCalledTimes(2);
  });

  it('treats an acknowledgment for another command as uncertain without replaying Home', async () => {
    fetchDisplay.mockResolvedValueOnce(
      Response.json({
        ok: true,
        command: 'back',
        executed: true,
        transport: 'adb',
      }),
    );
    await expect(service.viewerControl(app, 'home')).rejects.toMatchObject({
      response: { code: 'control_outcome_unknown' },
    });
    expect(fetchDisplay).toHaveBeenCalledTimes(2);
  });

  it('preserves a rejection before dispatch without replaying Home', async () => {
    fetchDisplay.mockResolvedValueOnce(
      Response.json(
        { code: 'control_not_dispatched', message: 'Control unavailable.' },
        { status: 409 },
      ),
    );
    await expect(service.viewerControl(app, 'home')).rejects.toMatchObject({
      response: {
        code: 'control_not_dispatched',
        message: 'Control unavailable.',
      },
    });
    expect(fetchDisplay).toHaveBeenCalledTimes(2);
  });

  it('reports a connection loss during dispatch as uncertain without replaying Home', async () => {
    fetchDisplay.mockRejectedValueOnce(new Error('Connection closed.'));
    await expect(service.viewerControl(app, 'home')).rejects.toMatchObject({
      response: { code: 'control_outcome_unknown' },
    });
    expect(fetchDisplay).toHaveBeenCalledTimes(2);
  });
});
