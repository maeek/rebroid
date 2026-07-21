import type { AndroidAppsRuntimeInventoryPort } from '../../../android-apps/contracts/android-apps-runtime-inventory.port';
import type { DockerPlatformContainersPort } from '../../../docker/contracts/docker-platform-containers.port';
import type { PlatformContainer } from '../../../docker/docker.types';
import { DockerMaintenanceContainerQueryService } from './docker-maintenance-container-query.service';

const container = (
  patch: Partial<PlatformContainer> = {},
): PlatformContainer => ({
  id: 'container-1',
  shortId: 'container',
  names: ['runtime'],
  image: 'redroid/redroid:14',
  imageId: 'image-1',
  command: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  state: 'running',
  status: 'Up',
  labels: {},
  managed: true,
  orphaned: false,
  applicationId: 'app-1',
  component: 'runtime',
  ports: [],
  networks: ['network-1'],
  ...patch,
});

describe('DockerMaintenanceContainerQueryService', () => {
  it('marks managed containers without an application as orphaned', async () => {
    const containers = {
      listPlatformContainers: jest
        .fn()
        .mockResolvedValue([
          container(),
          container({ id: 'container-2', applicationId: 'app-2' }),
        ]),
    } as unknown as DockerPlatformContainersPort;
    const applications = {
      findExistingIds: jest.fn().mockResolvedValue(new Set(['app-2'])),
    } as unknown as AndroidAppsRuntimeInventoryPort;
    const service = new DockerMaintenanceContainerQueryService(
      containers,
      applications,
    );

    await expect(service.listContainers()).resolves.toEqual([
      expect.objectContaining({ id: 'container-1', orphaned: true }),
      expect.objectContaining({ id: 'container-2', orphaned: false }),
    ]);
    expect(applications.findExistingIds).toHaveBeenCalledWith([
      'app-1',
      'app-2',
    ]);
  });

  it('does not query applications for unmanaged containers', async () => {
    const containers = {
      listPlatformContainers: jest
        .fn()
        .mockResolvedValue([
          container({ managed: false, applicationId: null }),
        ]),
    } as unknown as DockerPlatformContainersPort;
    const applications = {
      findExistingIds: jest.fn(),
    } as unknown as AndroidAppsRuntimeInventoryPort;
    const service = new DockerMaintenanceContainerQueryService(
      containers,
      applications,
    );

    await expect(service.listContainers()).resolves.toEqual([
      expect.objectContaining({ orphaned: false }),
    ]);
    expect(applications.findExistingIds).not.toHaveBeenCalled();
  });
});
