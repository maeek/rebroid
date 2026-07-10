import { AndroidAppsSidecarAdbService } from './android-apps-sidecar-adb.service';

describe('AndroidAppsSidecarAdbService target cache', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('invalidates the prepared ADB target when the container identity changes', async () => {
    global.fetch = jest.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,a',
            capturedAt: '2026-07-10T00:00:00.000Z',
          }),
          { status: 200 },
        ),
    );
    const network = {
      prepareNetwork: jest.fn(),
      resolveScrcpyAdbHost: jest.fn().mockResolvedValue('10.0.0.2'),
      prepareScrcpyAdbTarget: jest
        .fn()
        .mockResolvedValue({ configured: true, connected: true }),
    };
    const service = new AndroidAppsSidecarAdbService(
      {
        getOrThrow: jest.fn().mockReturnValue('http://sidecar.test'),
        get: jest.fn().mockReturnValue('secret'),
      } as never,
      network as never,
    );
    const app = {
      id: 'app-1',
      containerId: 'container-1',
      containerName: 'rebroid-app-1',
      networkName: 'rebroid-network-1',
      adbPort: 5555,
    };

    await service.screenshot(app as never);
    await service.screenshot({ ...app, containerId: 'container-2' } as never);

    expect(network.prepareNetwork).toHaveBeenCalledTimes(2);
    expect(network.prepareScrcpyAdbTarget).toHaveBeenCalledTimes(2);
  });
});
