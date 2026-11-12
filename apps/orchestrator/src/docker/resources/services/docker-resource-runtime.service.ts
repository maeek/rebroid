import { Injectable } from '@nestjs/common';
import { waitForOperation } from '../../../common/wait-for-operation';
import { DockerEngineService } from '../../docker-engine.service';
import {
  ContainerResourceUsage,
  ManagedContainerResourceSample,
  ManagedContainerSummary,
} from '../../docker.types';
import { DockerInventoryService } from '../../inventory/docker-inventory.service';
import {
  calculateContainerCpuUsagePercent,
  calculateContainerMemoryUsageBytes,
  calculateContainerNetworkUsageBytes,
} from '../../utils/docker-runtime.utils';
import type { DockerResourceRuntimePort } from '../../contracts/docker-resource-runtime.port';

const STATS_FRESHNESS_MS = 5_000;
const CAPACITY_FRESHNESS_MS = 30_000;
const MAX_CACHED_STATS = 256;
const STATS_SWEEP_CONCURRENCY = 4;
const STATS_SWEEP_TIMEOUT_MS = 7_000;

type HostCapacity = Awaited<
  ReturnType<DockerResourceRuntimePort['hostCapacity']>
>;

@Injectable()
export class DockerResourceRuntimeService implements DockerResourceRuntimePort {
  private readonly pendingStats = new Map<
    string,
    Promise<ContainerResourceUsage>
  >();
  private readonly stats = new Map<
    string,
    { expiresAt: number; value: ContainerResourceUsage }
  >();
  private capacity?: { expiresAt: number; value: HostCapacity };
  private pendingCapacity?: Promise<HostCapacity>;

  constructor(
    private readonly engine: DockerEngineService,
    private readonly inventory: DockerInventoryService,
  ) {}

  get hasPendingDockerWork() {
    return this.engine.hasPendingDockerWork;
  }

  async engineSummary() {
    const info = await this.engine.info();
    return {
      id: info.ID,
      name: info.Name,
      serverVersion: info.ServerVersion,
      operatingSystem: info.OperatingSystem,
      dockerRootDir: info.DockerRootDir,
      cgroupVersion: info.CgroupVersion,
      cgroupDriver: info.CgroupDriver,
      securityOptions: info.SecurityOptions ?? [],
    };
  }

  hostCapacity() {
    if (this.capacity && this.capacity.expiresAt > performance.now()) {
      return Promise.resolve(this.capacity.value);
    }
    this.pendingCapacity ??= this.collectHostCapacity()
      .then((value) => {
        this.capacity = {
          expiresAt: performance.now() + CAPACITY_FRESHNESS_MS,
          value,
        };
        return value;
      })
      .finally(() => {
        this.pendingCapacity = undefined;
      });
    return this.pendingCapacity;
  }

  private async collectHostCapacity() {
    const info = await this.engine.info();

    return {
      memoryBytes: typeof info.MemTotal === 'number' ? info.MemTotal : null,
      cpuCores: typeof info.NCPU === 'number' ? info.NCPU : null,
      dockerRootDir:
        typeof info.DockerRootDir === 'string' && info.DockerRootDir.trim()
          ? info.DockerRootDir
          : null,
    };
  }

  /**
   * Creates the persistent app volume if it does not exist already.
   */
  async createVolume(applicationId: string, volumeName: string) {
    const existing = await this.findVolumeByName(volumeName);
    if (existing) {
      return existing;
    }

    try {
      return await this.engine.mutate(
        () =>
          this.engine.docker.createVolume({
            Name: volumeName,
            Labels: this.engine.labels(applicationId, 'volume'),
          }),
        `Create volume ${volumeName}`,
      );
    } catch (error) {
      if (!this.engine.isResourceAlreadyExists(error)) {
        throw error;
      }

      const duplicate = await this.findVolumeByName(volumeName);
      if (duplicate) {
        return duplicate;
      }

      throw error;
    }
  }

  async removeVolume(volumeName: string) {
    try {
      await this.engine.mutate(
        () => this.engine.docker.getVolume(volumeName).remove(),
        `Remove volume ${volumeName}`,
      );
    } catch (error) {
      if (!this.engine.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  async inspectVolume(volumeName: string) {
    try {
      return await this.engine.read(
        () => this.engine.docker.getVolume(volumeName).inspect(),
        `Inspect volume ${volumeName}`,
      );
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  listManagedContainers() {
    return this.inventory.listManagedContainers();
  }

  getContainerResourceUsage(
    containerId: string,
  ): Promise<ContainerResourceUsage> {
    // A name or short ID may resolve to a different container on the next read.
    if (!/^[a-f0-9]{64}$/.test(containerId))
      return this.collectStats(containerId);
    const cached = this.stats.get(containerId);
    if (cached && cached.expiresAt > performance.now())
      return Promise.resolve(cached.value);
    this.stats.delete(containerId);

    const pending = this.pendingStats.get(containerId);
    if (pending) return pending;
    const request = this.collectStats(containerId)
      .then((value) => {
        if (this.stats.size >= MAX_CACHED_STATS) {
          const oldest = this.stats.keys().next();
          if (!oldest.done) this.stats.delete(oldest.value);
        }
        this.stats.set(containerId, {
          expiresAt: performance.now() + STATS_FRESHNESS_MS,
          value,
        });
        return value;
      })
      .finally(() => this.pendingStats.delete(containerId));
    this.pendingStats.set(containerId, request);
    return request;
  }

  private async collectStats(
    containerId: string,
  ): Promise<ContainerResourceUsage> {
    const stats = await this.engine.readStats((abortSignal) => {
      // Dockerode forwards abortSignal but its published stats overload omits it.
      const options = { stream: false as const, abortSignal };
      return this.engine.docker.getContainer(containerId).stats(options);
    });
    const networkUsage = calculateContainerNetworkUsageBytes(stats);

    return {
      cpuUsagePercent: calculateContainerCpuUsagePercent(stats),
      memoryUsageBytes: calculateContainerMemoryUsageBytes(stats),
      memoryLimitBytes: stats.memory_stats?.limit ?? null,
      networkRxBytes: networkUsage.rxBytes,
      networkTxBytes: networkUsage.txBytes,
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * Aggregates CPU and memory usage across currently running managed containers.
   * Returns the samples available before the sweep deadline and their coverage.
   */
  async getManagedContainerResourceUsage(
    containers?: ManagedContainerSummary[],
  ) {
    const managedContainers =
      containers ?? (await this.listManagedContainers());
    const totals: ManagedContainerResourceSample = {
      cpuUsagePercent: 0,
      memoryUsageBytes: 0,
      collectedAt: null,
      sampledContainers: 0,
    };
    const addSample = (sample: ContainerResourceUsage) => {
      totals.cpuUsagePercent += sample.cpuUsagePercent;
      totals.memoryUsageBytes += sample.memoryUsageBytes;
      totals.sampledContainers += 1;
      if (!totals.collectedAt || sample.collectedAt < totals.collectedAt) {
        totals.collectedAt = sample.collectedAt;
      }
    };
    const now = performance.now();
    const remaining: ManagedContainerSummary[] = [];
    for (const container of managedContainers) {
      if (container.state !== 'running') continue;
      const cached = this.stats.get(container.id);
      if (cached && cached.expiresAt > now) addSample(cached.value);
      else remaining.push(container);
    }
    // Refresh containers without recent samples first when the fleet outgrows a sweep.
    remaining.sort(
      (a, b) =>
        (this.stats.get(a.id)?.expiresAt ?? 0) -
        (this.stats.get(b.id)?.expiresAt ?? 0),
    );
    const containersToSample = remaining.values();
    const signal = AbortSignal.timeout(STATS_SWEEP_TIMEOUT_MS);

    const sampleContainers = async () => {
      for (const container of containersToSample) {
        if (signal.aborted) return;
        try {
          const sample = await waitForOperation(
            this.getContainerResourceUsage(container.id),
            signal,
          );
          addSample(sample);
        } catch {
          // Docker diagnostics record failed reads. Coverage accounts for missing samples.
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(STATS_SWEEP_CONCURRENCY, remaining.length) },
        sampleContainers,
      ),
    );

    return totals;
  }

  private async findVolumeByName(name: string) {
    const volumes = await this.engine.read(
      () =>
        this.engine.docker.listVolumes({
          filters: { name: [name] },
        }),
      `List volumes while finding ${name}`,
    );
    const volume = volumes.Volumes?.find((item) => item.Name === name);
    return volume ? this.engine.docker.getVolume(volume.Name) : undefined;
  }
}
