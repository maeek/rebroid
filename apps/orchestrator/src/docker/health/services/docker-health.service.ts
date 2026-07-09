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
import type { DockerHealthPort } from '../../contracts/docker-health.port';

@Injectable()
export class DockerHealthService implements DockerHealthPort {
  private dockerHealthSummaryRequest: Promise<ServiceHealth> | null = null;
  private dockerHealthSummaryCache: {
    value: ServiceHealth;
    expiresAt: number;
  } | null = null;
  private runtimeSummaryRequest: Promise<ServiceHealth> | null = null;
  private runtimeSummaryCache: {
    value: ServiceHealth;
    expiresAt: number;
  } | null = null;
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
      const operatingSystem = readFirstString(info, [['OperatingSystem']]);
      const osType = readFirstString(info, [['OSType']]);
      const architecture = readFirstString(info, [['Architecture']]);
      const kernelVersion = readFirstString(info, [['KernelVersion']]);
      const rootless = isRootlessContainerEngine(info);
      const details = {
        rootless,
        operatingSystem,
        osType,
        architecture,
        kernelVersion,
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

      if (operatingSystem?.toLowerCase().includes('docker desktop')) {
        return {
          ok: false,
          status: 'unhealthy',
          message:
            'Docker Desktop runs containers inside a VM. Redroid usually needs a native Linux host with binder devices exposed to a rootful privileged engine.',
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

  async displaySidecarHealth(): Promise<ServiceHealth> {
    return this.sidecar.health();
  }

  dockerHealthSummary() {
    return this.cachedHealth(
      'dockerHealthSummaryRequest',
      'dockerHealthSummaryCache',
      5_000,
      () => this.dockerHealth(),
    );
  }

  runtimeSuitabilityHealthSummary() {
    return this.cachedHealth(
      'runtimeSummaryRequest',
      'runtimeSummaryCache',
      60_000,
      () => this.runtimeSuitabilityHealth(),
    );
  }

  displaySidecarSummaryHealth() {
    return this.sidecar.shallowHealth();
  }

  private cachedHealth(
    requestKey: 'dockerHealthSummaryRequest' | 'runtimeSummaryRequest',
    cacheKey: 'dockerHealthSummaryCache' | 'runtimeSummaryCache',
    ttlMs: number,
    collect: () => Promise<ServiceHealth>,
  ) {
    const cached = this[cacheKey];
    if (cached && cached.expiresAt > Date.now())
      return Promise.resolve(cached.value);
    const existing = this[requestKey];
    if (existing) return existing;
    const pending = collect()
      .then((value) => {
        this[cacheKey] = { value, expiresAt: Date.now() + ttlMs };
        return value;
      })
      .finally(() => {
        if (this[requestKey] === pending) this[requestKey] = null;
      });
    this[requestKey] = pending;
    return pending;
  }
}
