import { DockerPlatformPruneService } from '../../../docker/prune/services/docker-platform-prune.service';
import { DockerMaintenancePruneController } from './docker-maintenance-prune.controller';

describe('DockerMaintenancePruneController', () => {
  it('runs full cleanup sequentially', async () => {
    const events: string[] = [];
    const prune = {
      pruneContainers: jest.fn(async () => {
        events.push('containers');
        return {};
      }),
      pruneNetworks: jest.fn(async () => {
        events.push('networks');
        return {};
      }),
      pruneImages: jest.fn(async () => {
        events.push('images');
        return {};
      }),
      pruneVolumes: jest.fn(async () => {
        events.push('volumes');
        return {};
      }),
    } as unknown as DockerPlatformPruneService;
    const controller = new DockerMaintenancePruneController(prune);

    await controller.pruneAll();

    expect(events).toEqual(['containers', 'networks', 'images', 'volumes']);
    expect(prune.pruneImages).toHaveBeenCalledWith(true);
  });
});
