import { Injectable } from '@nestjs/common';
import type Dockerode from 'dockerode';
import { platformContainerFromInfo } from '../containers/utils/platform-container.utils';
import { DockerEngineService } from '../docker-engine.service';
import type {
  ManagedContainerSummary,
  PlatformContainer,
  PlatformImage,
  PlatformNetwork,
} from '../docker.types';
import { platformImageFromSummary } from '../images/utils/platform-image.utils';
import { platformNetworkFromSummary } from '../networks/utils/platform-network.utils';

const snapshotLifetimeMs = 5_000;
const maxSnapshotRows = 2_048;
const maxSnapshotBytes = 1024 * 1024;

type InventorySnapshot<T> = {
  cached?: { revision: number; expiresAt: number; items: T[] };
  pending?: { revision: number; result: Promise<T[]> };
};

@Injectable()
export class DockerInventoryService {
  private readonly containers: InventorySnapshot<PlatformContainer> = {};
  private readonly managedContainers: InventorySnapshot<ManagedContainerSummary> =
    {};
  private readonly images: InventorySnapshot<PlatformImage> = {};
  private readonly networks: InventorySnapshot<PlatformNetwork> = {};

  constructor(private readonly engine: DockerEngineService) {}

  listContainers() {
    return this.readSnapshot(this.containers, async () => {
      const rows = await this.engine.read(
        () => this.engine.docker.listContainers({ all: true }),
        'List platform containers',
      );
      return rows.map(platformContainerFromInfo);
    });
  }

  listManagedContainers() {
    const managed = this.freshItems(this.managedContainers);
    if (managed) return Promise.resolve(managed);

    const containers = this.freshItems(this.containers);
    if (containers) {
      return Promise.resolve(
        containers
          .filter(({ managed }) => managed)
          .map(({ id, names, state, status }) => ({
            id,
            name: names[0] ?? id.slice(0, 12),
            state,
            status,
          })),
      );
    }

    return this.readSnapshot(this.managedContainers, async () => {
      const rows = await this.engine.read(
        () =>
          this.engine.docker.listContainers({
            all: true,
            filters: { label: ['com.rebroid.managed=true'] },
          }),
        'List managed containers',
      );
      return rows.map(({ Id, Names, State, Status }) => ({
        id: Id,
        name: Names[0]?.replace(/^\//, '') ?? Id.slice(0, 12),
        state: State,
        status: Status,
      }));
    });
  }

  listImages() {
    return this.readSnapshot(this.images, async () => {
      const rows = await this.engine.read(
        () => this.engine.docker.listImages({ all: true }),
        'List platform images',
      );
      return rows.map((image) => platformImageFromSummary(image));
    });
  }

  listNetworks() {
    return this.readSnapshot(this.networks, async () => {
      const rows = await this.engine.read(
        () => this.engine.docker.listNetworks(),
        'List platform networks',
      );
      return rows.map((network) =>
        platformNetworkFromSummary(network as Dockerode.NetworkInspectInfo),
      );
    });
  }

  private freshItems<T>(snapshot: InventorySnapshot<T>) {
    const cached = snapshot.cached;
    if (
      cached &&
      cached.revision === this.engine.currentInventoryRevision &&
      cached.expiresAt > performance.now()
    ) {
      return cached.items;
    }
    snapshot.cached = undefined;
    return undefined;
  }

  private readSnapshot<T>(
    snapshot: InventorySnapshot<T>,
    load: () => Promise<T[]>,
  ) {
    const cached = this.freshItems(snapshot);
    if (cached) return Promise.resolve(cached);

    const revision = this.engine.currentInventoryRevision;
    const pending = snapshot.pending;
    if (pending && pending.revision === revision) return pending.result;

    const result = load()
      .then((items) => {
        if (
          revision === this.engine.currentInventoryRevision &&
          fitsCache(items)
        ) {
          snapshot.cached = {
            revision,
            expiresAt: performance.now() + snapshotLifetimeMs,
            items,
          };
        }
        return items;
      })
      .finally(() => {
        if (snapshot.pending?.result === result) snapshot.pending = undefined;
      });
    snapshot.pending = { revision, result };
    return result;
  }
}

function fitsCache(items: unknown[]) {
  if (items.length > maxSnapshotRows) return false;
  let bytes = 2;
  for (const item of items) {
    bytes += Buffer.byteLength(JSON.stringify(item)) + 1;
    if (bytes > maxSnapshotBytes) return false;
  }
  return true;
}
