import { ConfigService } from '@nestjs/config';
import { AutomationRunAuthorizationService } from './automation-run-authorization.service';

describe('automation authorization transport', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it('uses the internal secret and rejects authorization failures', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: false });
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
});
