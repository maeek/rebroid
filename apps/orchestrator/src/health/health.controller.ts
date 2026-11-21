import { Inject, Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  DOCKER_HEALTH,
  type DockerHealthPort,
} from '../docker/contracts/docker-health.port';
import { OrchestratorDiagnosticsDto } from './dto/health-response.dto';
import { OrchestratorDiagnosticsService } from './orchestrator-diagnostics.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @Inject(DOCKER_HEALTH)
    private readonly docker: DockerHealthPort,
    private readonly diagnosticReads: OrchestratorDiagnosticsService,
  ) {}

  @Get('health/live')
  live() {
    return { ok: true, service: 'rebroid-orchestrator' };
  }

  @Get('health/ready')
  async ready() {
    const docker = await this.docker.dockerHealth();
    return { ok: docker.ok, services: { docker } };
  }

  @Get('diagnostics')
  @ApiOkResponse({ type: OrchestratorDiagnosticsDto })
  async diagnostics() {
    return this.diagnosticReads.read(false);
  }

  @Get('diagnostics/summary')
  @ApiOkResponse({ type: OrchestratorDiagnosticsDto })
  async diagnosticsSummary() {
    return this.diagnosticReads.read(true);
  }
}
