import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ExternalAdbDaemon } from "../external-adb/external-adb-daemon";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { HealthDto } from "./health.dto";

@Controller()
@ApiTags("health")
export class HealthController {
  constructor(
    private readonly config: SidecarConfigService,
    private readonly externalAdb: ExternalAdbDaemon,
  ) {}

  @Get("health/live")
  @ApiOperation({ summary: "Read sidecar process health." })
  @ApiOkResponse({ type: HealthDto })
  health() {
    return {
      ok: true,
      service: "rebroid-display-sidecar",
      port: this.config.port,
      auth: {
        sharedSecretConfigured: this.config.hasSharedSecret,
      },
    };
  }

  @Get("health/ready")
  @ApiOperation({ summary: "Read sidecar readiness." })
  @ApiOkResponse({ type: HealthDto })
  @ApiServiceUnavailableResponse({ type: HealthDto })
  async ready() {
    const health = this.health();
    if (!this.config.externalAdbEnabled || !health.auth.sharedSecretConfigured)
      return health;

    const externalAdb = await this.externalAdb.readiness();
    if (!externalAdb.adb || !externalAdb.keyStorage)
      throw new ServiceUnavailableException({
        ...health,
        ok: false,
        externalAdb,
      });
    return { ...health, externalAdb };
  }
}
