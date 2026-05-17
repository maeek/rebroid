import { Injectable } from '@nestjs/common';
import { DockerEngineService } from './docker-engine.service';
import { DockerSidecarService } from './docker-sidecar.service';
import { ServiceHealth } from './docker.types';

@Injectable()
export class DockerHealthService {
  constructor(
    private readonly engine: DockerEngineService,
    private readonly sidecar: DockerSidecarService,
  ) {}

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

  async wsScrcpyHealth(): Promise<ServiceHealth> {
    return this.sidecar.health();
  }

  async repairWsScrcpySidecar() {
    return this.sidecar.repair();
  }
}