import { Controller, Get } from '@nestjs/common';
import { SidecarConfigService } from '../shared/sidecar-config.service';

@Controller()
export class HealthController {
  constructor(private readonly config: SidecarConfigService) {}

  @Get('health')
  health() {
    return {
      ok: true,
      service: 'rebroid-display-sidecar',
      port: this.config.port,
      auth: {
        sharedSecretConfigured: this.config.hasSharedSecret,
      },
    };
  }
}
