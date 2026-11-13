import { OperationDeadline } from '../../../common/operation-deadline';
import { BadGatewayException } from '@nestjs/common';
import { DockerSidecarApiService } from './docker-sidecar-api.service';

const session = {
  id: 'session-1',
  appId: 'app-1',
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
        getManifest: jest.fn(() => ({
          revision: 4,
          features: [
            {
              key: 'feature.display-virtual',
              owner: 'display',
              enabled: true,
              supported: true,
            },
            {
              key: 'feature.display-webrtc',
              owner: 'display',
              enabled: false,
              supported: true,
            },
            {
              key: 'feature.workflows',
              owner: 'automations',
              enabled: true,
              supported: true,
            },
          ],
        })),
        markSynchronization: jest.fn(),
      } as never,
    );

  it('authenticates requests and validates generated response shapes', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        Response.json({ items: [{ ...session, ownerUserId: 'owner-1' }] }),
      );
    global.fetch = fetchMock;

    await expect(service().listDisplaySessions()).resolves.toEqual([
      expect.objectContaining({
        id: 'session-1',
        applicationId: 'app-1',
        ownerUserId: 'owner-1',
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://display.test/rebroid/display/sessions/inventory',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-rebroid-sidecar-secret': 'internal-secret',
        }),
      }),
    );
  });

  it('posts owner-scoped revocation and validates the acknowledgement', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(Response.json({ released: 2 }))
      .mockResolvedValueOnce(Response.json({ released: 'two' }));
    global.fetch = fetchMock;

    await expect(service().revokeDisplaySessions(['owner-1'])).resolves.toEqual(
      { released: 2 },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://display.test/rebroid/display/sessions/revoke',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ownerUserIds: ['owner-1'] }),
        headers: expect.objectContaining({
          'x-rebroid-sidecar-secret': 'internal-secret',
        }),
      }),
    );
    await expect(
      service().revokeDisplaySessions(['owner-1']),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('accepts the public projection returned when a single session is released', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(Response.json({ ...session, status: 'released' }));

    await expect(
      service().releaseDisplaySession(session.id),
    ).resolves.toMatchObject({
      id: session.id,
      applicationId: session.appId,
      status: 'released',
    });
  });

  it('rejects malformed and non-success responses', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{}] }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
    const client = service();

    await expect(client.listDisplaySessions()).rejects.toMatchObject({
      response: { code: 'display_sidecar_invalid_response' },
    });
    await expect(client.listDisplaySessions()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('synchronizes only display-owned features and the revision', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ revision: 4, features: [] }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;

    await service().synchronizeFeatures();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      revision: 4,
      features: [
        { key: 'feature.display-virtual', effective: true },
        { key: 'feature.display-webrtc', effective: false },
      ],
    });
  });

  it.each(['health', 'features'])(
    'bounds the %s readiness request by the caller deadline',
    async (phase) => {
      jest.useFakeTimers();
      try {
        jest.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
          const controller = new AbortController();
          setTimeout(() => controller.abort(new Error('timeout')), ms);
          return controller.signal;
        });
        const fetchMock = jest.fn(
          (_url: unknown, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener(
                'abort',
                () => reject(init?.signal?.reason),
                { once: true },
              );
            }),
        );
        if (phase === 'features')
          fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));
        global.fetch = fetchMock;
        const pending = service().waitForReady(10_000, {
          deadline: new OperationDeadline(50),
        });
        const rejected = expect(pending).rejects.toThrow('deadline');
        await jest.advanceTimersByTimeAsync(50);
        await rejected;
        expect(fetchMock).toHaveBeenCalledTimes(phase === 'health' ? 1 : 2);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('propagates cancellation while waiting for health without beginning feature synchronization', async () => {
    const controller = new AbortController();
    global.fetch = jest.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    );
    const pending = service().waitForReady(10_000, {
      signal: controller.signal,
    });
    controller.abort(new Error('startup cancelled'));
    await expect(pending).rejects.toThrow('startup cancelled');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
