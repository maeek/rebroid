import { DockerMaintenancePruneController } from './docker-maintenance-prune.controller';

describe('DockerMaintenancePruneController', () => {
  it('returns the full cleanup result from Docker', async () => {
    const result = {
      containers: { ContainersDeleted: [], SpaceReclaimed: 0 },
      networks: { NetworksDeleted: [] },
      images: { ImagesDeleted: [], SpaceReclaimed: 0 },
      volumes: { VolumesDeleted: [], SpaceReclaimed: 0 },
    };
    const prune = {
      pruneContainers: jest.fn(),
      pruneNetworks: jest.fn(),
      pruneImages: jest.fn(),
      pruneVolumes: jest.fn(),
      pruneAll: jest.fn().mockResolvedValue(result),
    };
    const controller = new DockerMaintenancePruneController(prune);

    await expect(controller.pruneAll()).resolves.toBe(result);
  });
});
