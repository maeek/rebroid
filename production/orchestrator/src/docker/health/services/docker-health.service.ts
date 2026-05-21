import { Injectable } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';
import { DockerSidecarService } from '../../sidecar/services/docker-sidecar.service';
import { ServiceHealth } from '../../docker.types';
import {
  isRootlessContainerEngine,
  readFirstBoolean,
  readFirstString,
  readStringArray,
} from '../utils/docker-health.utils';

@Injectable()
export class DockerHealthService {
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
      const info = await this.engine.info();
      const securityOptions = readStringArray(info, ['SecurityOptions']);
      const graphRoot = readFirstString(info, [
        ['DockerRootDir'],
        ['Store', 'GraphRoot'],
        ['store', 'graphRoot'],
      ]);
      const cgroupVersion = readFirstString(info, [
        ['CgroupVersion'],
        ['Host', 'CgroupVersion'],
        ['host', 'cgroupVersion'],
      ]);
      const cgroupManager = readFirstString(info, [
        ['CgroupDriver'],
        ['Host', 'CgroupManager'],
        ['host', 'cgroupManager'],
      ]);
      const memoryLimit = readFirstBoolean(info, [
        ['MemoryLimit'],
        ['Host', 'MemoryLimit'],
        ['host', 'memoryLimit'],
      ]);
      const rootless = isRootlessContainerEngine(info);
      const details = {
        rootless,
        graphRoot,
        cgroupVersion,
        cgroupManager,
        memoryLimit,
        securityOptions: securityOptions.join(', ') || null,
      };

      if (rootless) {
        return {
          ok: false,
          status: 'unhealthy',
          message:
            'Container engine is rootless. Redroid needs a rootful privileged Docker-compatible engine.',
          details,
        };
      }

      if (memoryLimit === false) {
        return {
          ok: false,
          status: 'unhealthy',
          message:
            'Container engine reports that memory limits are unavailable. Disable app memory limits or fix host cgroups before starting redroid.',
          details,
        };
      }

      return {
        ok: true,
        status: 'healthy',
        message: 'Container runtime is suitable for privileged app containers.',
        details,
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
}
