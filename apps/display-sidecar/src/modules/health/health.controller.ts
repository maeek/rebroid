import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { HealthDto } from "./health.dto";

@Controller()
@ApiTags("health")
export class HealthController {
  constructor(private readonly config: SidecarConfigService) {}

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
  ready() {
    return this.health();
  }
}
