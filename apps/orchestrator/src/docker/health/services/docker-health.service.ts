import { Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import { DockerSidecarService } from '../../sidecar/services/docker-sidecar.service';
import { ServiceHealth } from '../../docker.types';
import { assessRuntimeSuitability } from '../utils/runtime-suitability';
import type { DockerHealthPort } from '../../contracts/docker-health.port';

@Injectable()
export class DockerHealthService implements DockerHealthPort {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly sidecar: DockerSidecarService,
  ) {}

  /**
   * Checks basic Docker API reachability without inspecting any managed resource.
   */
  async dockerHealth(): Promise<ServiceHealth> {
    try {
      await this.engine.ping();
      return {
        ok: true,
        status: 'healthy',
        message: 'Docker API is reachable.',
      };
    } catch (error) {
      return {
        ok: false,
        status: 'offline',
        message: this.engine.errorMessage(error),
      };
    }
  }

  async runtimeSuitabilityHealth(): Promise<ServiceHealth> {
    try {
      return assessRuntimeSuitability(await this.engine.info());
    } catch (error) {
      return {
        ok: false,
        status: 'offline',
        message: this.engine.errorMessage(error),
      };
    }
  }

  async displaySidecarHealth(): Promise<ServiceHealth> {
    return this.sidecar.health();
  }

  displaySidecarSummaryHealth() {
    return this.sidecar.shallowHealth();
  }
}
