import { DockerHealthService } from './docker-health.service';

const assess = (info: unknown) =>
  new DockerHealthService(
    { info: async () => info } as never,
    {} as never,
  ).runtimeSuitabilityHealth();

it('resolves Docker and Podman field aliases while retaining explicit false and original text', async () => {
  const health = await assess({
    DockerRootDir: ' ',
    Store: { GraphRoot: '/podman/storage' },
    MemoryLimit: false,
    Host: { MemoryLimit: true, CgroupVersion: 'v2' },
    host: { cgroupManager: 'systemd' },
    SecurityOptions: [' isolated ', ' ', 1],
  });
  expect(health).toMatchObject({
    ok: false,
    message: expect.stringContaining('memory limits'),
    details: {
      graphRoot: '/podman/storage',
      cgroupVersion: 'v2',
      cgroupManager: 'systemd',
      memoryLimit: false,
      securityOptions: ' isolated ',
    },
  });
});

it.each([
  { Host: { Security: { Rootless: true } } },
  { host: { security: { rootless: true } } },
  { SecurityOptions: ['Name=RootLess'] },
  { store: { graphRoot: '/home/test/.local/share/containers/storage' } },
])('gives rootless engines precedence over other diagnostics', async (info) => {
  const health = await assess({
    ...info,
    OperatingSystem: 'DOCKER DESKTOP',
    MemoryLimit: false,
  });
  expect(health).toMatchObject({
    status: 'unhealthy',
    details: { rootless: true },
    message: expect.stringContaining('rootless'),
  });
});

it('reports Docker Desktop separately and retains unknown properties as null', async () => {
  expect(await assess({ OperatingSystem: 'Docker Desktop' })).toMatchObject({
    status: 'unhealthy',
    message: expect.stringContaining('Docker Desktop'),
  });
  expect(await assess(null)).toMatchObject({
    status: 'healthy',
    details: {
      rootless: false,
      graphRoot: null,
      memoryLimit: null,
      securityOptions: null,
    },
  });
});
