import { DockerContainerProvisioningService } from './docker-container-provisioning.service';

it('retains a required GPU mapping when Docker rejects optional ashmem', async () => {
  const submittedDevices: unknown[] = [];
  const createContainer = jest.fn(
    async (input: { HostConfig: { Devices: unknown } }) => {
      submittedDevices.push(input.HostConfig.Devices);
      if (submittedDevices.length === 1)
        throw new Error('stat /dev/ashmem: no such file');
      throw new Error('stat /dev/dri/renderD128: no such file');
    },
  );
  const provisioner = new DockerContainerProvisioningService(
    {
      docker: { createContainer },
      mutate: (operation: () => Promise<unknown>) => operation(),
      labels: () => ({}),
      errorMessage: (error: Error) => error.message,
    } as never,
    { ensureImage: jest.fn() } as never,
    { findContainerByName: jest.fn() } as never,
  );

  await expect(
    provisioner.createApplicationContainer({
      applicationId: 'app',
      containerName: 'app-container',
      networkName: 'app-network',
      volumeName: 'saved-profile',
      dataMountPath: '/data',
      image: 'redroid/redroid:16.0.0-latest',
      adbPort: 5555,
      privileged: true,
      persistentData: true,
      devices: ['/dev/dri/renderD128:/dev/dri/renderD128:rwm'],
      optionalDevices: ['/dev/ashmem'],
    }),
  ).rejects.toThrow('/dev/dri/renderD128');

  const mapping = (path: string) => ({
    PathOnHost: path,
    PathInContainer: path,
    CgroupPermissions: 'rwm',
  });
  expect(submittedDevices).toEqual([
    [mapping('/dev/dri/renderD128'), mapping('/dev/ashmem')],
    [mapping('/dev/dri/renderD128')],
  ]);
});
