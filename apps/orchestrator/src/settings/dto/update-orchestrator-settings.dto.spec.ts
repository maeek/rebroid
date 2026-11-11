import { ValidationPipe } from '@nestjs/common';
import { UpdateOrchestratorSettingsDto } from './update-orchestrator-settings.dto';

const validate = (body: unknown) =>
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }).transform(body, {
    type: 'body',
    metatype: UpdateOrchestratorSettingsDto,
  });

describe('UpdateOrchestratorSettingsDto', () => {
  it('accepts scoped updates with or without rendering', async () => {
    const androidRendering = {
      mode: 'host',
      renderDevice: '/dev/dri/renderD128',
    };
    await expect(validate({ androidRendering })).resolves.toMatchObject({
      androidRendering,
    });
    await expect(validate({ maxApkUploadSizeMb: 256 })).resolves.toMatchObject({
      maxApkUploadSizeMb: 256,
    });
  });

  it.each([
    null,
    [],
    {},
    { mode: 'host', renderDevice: null },
    { mode: 'host', renderDevice: '/dev/sda' },
  ])('rejects invalid rendering settings %j', async (androidRendering) => {
    await expect(validate({ androidRendering })).rejects.toThrow();
  });

  it('validates a service update without requiring the other service', async () => {
    const firewall = { endpoint: '/run/firewall.sock', timeoutMs: 5000 };
    await expect(validate({ services: { firewall } })).resolves.toMatchObject({
      services: { firewall },
    });
    await expect(
      validate({ services: { firewall: { ...firewall, timeoutMs: 0 } } }),
    ).rejects.toThrow();
  });
});
