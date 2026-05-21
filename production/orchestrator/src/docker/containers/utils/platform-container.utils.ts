import Dockerode from 'dockerode';
import { PlatformContainer } from '../../docker.types';

export const platformContainerFromInfo = (
  container: Dockerode.ContainerInfo,
): PlatformContainer => ({
  id: container.Id,
  shortId: container.Id.slice(0, 12),
  names: container.Names.map((name) => name.replace(/^\//, '')),
  image: container.Image,
  imageId: container.ImageID,
  command: container.Command,
  createdAt: new Date(container.Created * 1000).toISOString(),
  state: container.State,
  status: container.Status,
  labels: container.Labels ?? {},
  managed: container.Labels?.['com.rebroid.managed'] === 'true',
  applicationId: container.Labels?.['com.rebroid.application-id'] ?? null,
  component: container.Labels?.['com.rebroid.component'] ?? null,
  ports: (container.Ports ?? []).map((port) => ({
    privatePort: port.PrivatePort,
    publicPort: port.PublicPort ?? null,
    type: port.Type,
    ip: port.IP ?? null,
  })),
  networks: Object.keys(container.NetworkSettings?.Networks ?? {}),
});

export const platformContainerFromInspect = (
  inspect: Dockerode.ContainerInspectInfo,
): PlatformContainer => {
  const labels = inspect.Config?.Labels ?? {};
  return {
    id: inspect.Id,
    shortId: inspect.Id.slice(0, 12),
    names: [inspect.Name?.replace(/^\//, '') || inspect.Id.slice(0, 12)],
    image: inspect.Config?.Image ?? inspect.Image,
    imageId: inspect.Image,
    command: inspect.Path
      ? [inspect.Path, ...(inspect.Args ?? [])].filter(Boolean).join(' ')
      : '',
    createdAt: new Date(inspect.Created).toISOString(),
    state: inspect.State?.Status ?? 'unknown',
    status: inspect.State?.Status ?? 'unknown',
    labels,
    managed: labels['com.rebroid.managed'] === 'true',
    applicationId: labels['com.rebroid.application-id'] ?? null,
    component: labels['com.rebroid.component'] ?? null,
    ports: Object.entries(inspect.NetworkSettings?.Ports ?? {}).flatMap(
      ([key, bindings]) => {
        const [privatePort, type] = key.split('/');
        if (!bindings) {
          return [
            {
              privatePort: Number(privatePort),
              publicPort: null,
              type: type ?? 'tcp',
              ip: null,
            },
          ];
        }

        return bindings.map((binding) => ({
          privatePort: Number(privatePort),
          publicPort: binding.HostPort ? Number(binding.HostPort) : null,
          type: type ?? 'tcp',
          ip: binding.HostIp || null,
        }));
      },
    ),
    networks: Object.keys(inspect.NetworkSettings?.Networks ?? {}),
  };
};
