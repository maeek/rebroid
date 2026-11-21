import type { DockerEngineService } from '../../docker-engine.service';
import { DockerPlatformPruneService } from './docker-platform-prune.service';

function setup() {
  const docker = {
    pruneContainers: jest.fn().mockResolvedValue({ ContainersDeleted: ['c'] }),
    pruneNetworks: jest.fn().mockResolvedValue({ NetworksDeleted: ['n'] }),
    pruneImages: jest
      .fn()
      .mockResolvedValue({ ImagesDeleted: [{ Deleted: 'i' }] }),
    pruneVolumes: jest.fn().mockResolvedValue({ VolumesDeleted: ['v'] }),
  };
  const events: string[] = [];
  const engine = {
    docker,
    async mutate<T>(operation: () => Promise<T>, label: string) {
      events.push(label);
      const result = await operation();
      events.push('done');
      return result;
    },
  } as unknown as DockerEngineService;
  return { docker, events, prune: new DockerPlatformPruneService(engine) };
}

describe('Docker full cleanup', () => {
  it('prunes in order and returns each result with dangling-only images', async () => {
    const { events, docker, prune } = setup();

    await expect(prune.pruneAll()).resolves.toEqual({
      containers: { ContainersDeleted: ['c'] },
      networks: { NetworksDeleted: ['n'] },
      images: { ImagesDeleted: [{ Deleted: 'i' }] },
      volumes: { VolumesDeleted: ['v'] },
    });
    expect(events).toEqual([
      'Prune Docker containers',
      'done',
      'Prune Docker networks',
      'done',
      'Prune Docker images',
      'done',
      'Prune Docker volumes',
      'done',
    ]);
    expect(docker.pruneImages).toHaveBeenCalledWith({ dangling: ['true'] });
  });

  it('stops before pruning images and volumes when network cleanup fails', async () => {
    const { docker, prune } = setup();
    const error = new Error('network prune failed');
    docker.pruneNetworks.mockRejectedValue(error);

    await expect(prune.pruneAll()).rejects.toBe(error);
    expect(docker.pruneImages).not.toHaveBeenCalled();
    expect(docker.pruneVolumes).not.toHaveBeenCalled();
  });
});
