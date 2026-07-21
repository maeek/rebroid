import { ConflictException } from '@nestjs/common';
import { DockerSidecarApiService } from './docker-sidecar-api.service';

const session = {
  id: 'session-1',
  udid: 'redroid:5555',
  surfaceId: 'main',
  surfaceKind: 'main' as const,
  displayName: 'Main display',
  status: 'active' as const,
  createdAt: '2026-07-21T00:00:00.000Z',
  lastActivityAt: '2026-07-21T00:00:01.000Z',
  expiresAt: '2026-07-21T00:15:00.000Z',
  maxExpiresAt: '2026-07-21T01:00:00.000Z',
  capabilities: ['video'],
  surface: {},
  surfaces: [],
  streamPath: '/stream',
  viewerPath: '/viewer',
  webrtcOfferPath: '/offer',
};

describe('DockerSidecarApiService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const service = () =>
    new DockerSidecarApiService(
      {
        get: jest.fn((key: string) =>
          key === 'app.sharedSecret' ? 'internal-secret' : undefined,
        ),
        getOrThrow: jest.fn(() => 'http://display.test'),
      } as never,
      { errorMessage: (error: unknown) => String(error) } as never,
      {
        getManifest: jest.fn(() => ({ revision: 4 })),
        getState: jest.fn(() => ({
          key: 'feature.display-virtual',
          enabled: true,
          supported: true,
        })),
        markSynchronization: jest.fn(),
      } as never,
    );

  it('authenticates requests and validates generated response shapes', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [session] }), { status: 200 }),
      );
    global.fetch = fetchMock;

    await expect(service().listDisplaySessions()).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://display.test/rebroid/display/sessions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-rebroid-sidecar-secret': 'internal-secret',
        }),
      }),
    );
  });

  it('rejects malformed and non-success responses', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{}] }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    const client = service();

    await expect(client.listDisplaySessions()).rejects.toMatchObject({
      response: { code: 'display_sidecar_invalid_response' },
    });
    await expect(client.listDisplaySessions()).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('synchronizes only the display-owned feature and revision', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ revision: 4, features: [] }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;

    await service().synchronizeFeatures();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      revision: 4,
      features: [{ key: 'feature.display-virtual', effective: true }],
    });
  });
});
