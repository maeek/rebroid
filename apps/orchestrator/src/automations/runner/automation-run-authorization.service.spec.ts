import { ConfigService } from '@nestjs/config';
import { AutomationRunAuthorizationService } from './automation-run-authorization.service';

describe('automation authorization transport', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it('uses the internal secret and rejects authorization failures', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    global.fetch = fetch;
    const service = new AutomationRunAuthorizationService(
      new ConfigService({
        app: { webInternalUrl: 'http://web:3101', sharedSecret: 'secret' },
      }),
    );
    await expect(
      service.assertAllowed('owner', { spec: { steps: [] } } as never, 'app', {
        operation: 'attach',
      }),
    ).rejects.toThrow('authorization');
    expect(fetch).toHaveBeenCalledWith(
      new URL('http://web:3101/api/internal/automations/authorize'),
      expect.objectContaining({
        redirect: 'error',
        headers: expect.objectContaining({ 'x-orchestrator-secret': 'secret' }),
      }),
    );
  });

  it.each([
    ['true', true],
    ['false', false],
    [null, false],
  ])(
    'takes the workflow egress grant from the authenticated web response (%s)',
    async (header, canUseInternet) => {
      const headers = new Headers();
      if (header !== null) headers.set('x-rebroid-allow-broad-egress', header);
      global.fetch = jest
        .fn()
        .mockResolvedValue(new Response(null, { status: 204, headers }));
      const service = new AutomationRunAuthorizationService(
        new ConfigService({
          app: { webInternalUrl: 'http://web:3101', sharedSecret: 'secret' },
        }),
      );
      await expect(
        service.assertAllowed(
          'owner',
          { spec: { steps: [] } } as never,
          'app',
          {
            operation: 'attach',
          },
        ),
      ).resolves.toEqual({ canUseInternet, maxOpenApps: undefined });
    },
  );

  it('keeps the request ID when the web service cannot be reached', async () => {
    const fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    global.fetch = fetch;
    const service = new AutomationRunAuthorizationService(
      new ConfigService({
        app: { webInternalUrl: 'http://web:3101', sharedSecret: 'secret' },
      }),
    );
    await expect(
      service.assertAllowed('owner', { spec: { steps: [] } } as never, 'app', {
        operation: 'attach',
      }),
    ).rejects.toMatchObject({
      message:
        'The web service could not be reached to authorize this workflow.',
      code: 'authorization_unreachable',
      requestId: expect.any(String),
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-request-id': expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
      }),
    );
  });
});
