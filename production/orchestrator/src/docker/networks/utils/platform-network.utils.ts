import Dockerode from 'dockerode';
import { PlatformNetwork } from '../../docker.types';
import { isString } from '../../docker.utils';

export const platformNetworkFromSummary = (
  network: Dockerode.NetworkInspectInfo,
): PlatformNetwork => {
  const containers = Object.keys(network.Containers ?? {});
  const ipamConfig = network.IPAM?.Config ?? [];

  return {
    id: network.Id,
    shortId: network.Id.slice(0, 12),
    name: network.Name,
    driver: network.Driver,
    scope: network.Scope,
    createdAt: network.Created ?? null,
    internal: Boolean(network.Internal),
    attachable: Boolean(network.Attachable),
    ingress: Boolean(network.Ingress),
    labels: network.Labels ?? {},
    managed: network.Labels?.['com.rebroid.managed'] === 'true',
    containers,
    subnets: ipamConfig.map((item) => item.Subnet).filter(isString),
    gateways: ipamConfig.map((item) => item.Gateway).filter(isString),
  };
};

export const platformNetworkFromInspect = (
  inspect: Dockerode.NetworkInspectInfo,
): PlatformNetwork => {
  const ipamConfig = inspect.IPAM?.Config ?? [];
  return {
    id: inspect.Id,
    shortId: inspect.Id.slice(0, 12),
    name: inspect.Name,
    driver: inspect.Driver,
    scope: inspect.Scope,
    createdAt: inspect.Created ?? null,
    internal: Boolean(inspect.Internal),
    attachable: Boolean(inspect.Attachable),
    ingress: Boolean(inspect.Ingress),
    labels: inspect.Labels ?? {},
    managed: inspect.Labels?.['com.rebroid.managed'] === 'true',
    containers: Object.keys(inspect.Containers ?? {}),
    subnets: ipamConfig.map((item) => item.Subnet).filter(isString),
    gateways: ipamConfig.map((item) => item.Gateway).filter(isString),
  };
};
