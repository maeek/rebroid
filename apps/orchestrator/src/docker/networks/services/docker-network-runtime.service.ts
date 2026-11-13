import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { normalizeIpv4Cidr } from '@rebroid/firewall-policy-core/policy';
import { DockerEngineService } from '../../docker-engine.service';
import type { DockerOperationOptions } from '../../contracts/docker-operation-options';
import type {
  DockerNetworkAttachmentTimings,
  DockerNetworkConnectObservation,
  DockerNetworkRuntimePort,
} from '../../contracts/docker-network-runtime.port';

@Injectable()
export class DockerNetworkRuntimeService implements DockerNetworkRuntimePort {
  private readonly logger = new Logger(DockerNetworkRuntimeService.name);

  constructor(private readonly engine: DockerEngineService) {}

  /**
   * Creates the app network if it does not exist already.
   * App networks are routable so host Docker can provide normal DNS and NAT egress.
   * Outbound restriction is handled separately by NetworkPolicyService when enabled.
   */
  async createIsolatedNetwork(applicationId: string, networkName: string) {
    const existing = await this.findNetworkByName(networkName);
    if (existing) {
      return this.ensureRoutableNetwork(applicationId, networkName, existing);
    }

    try {
      return await this.createNetwork(applicationId, networkName);
    } catch (error) {
      if (!this.engine.isResourceAlreadyExists(error)) {
        throw error;
      }

      const duplicate = await this.findNetworkByName(networkName);
      if (duplicate) {
        return this.ensureRoutableNetwork(
          applicationId,
          networkName,
          duplicate,
        );
      }

      throw error;
    }
  }

  /**
   * Attaches the orchestrator container to the app network when its container id is known.
   * Without this, control-plane access must come from another route.
   */
  async connectOrchestratorToNetwork(networkName: string) {
    const orchestrator = await this.inspectOrchestratorContainer();
    if (!orchestrator) {
      this.logger.warn(
        `The orchestrator is not identifiable on this container engine. Continuing without attaching it to ${networkName}.`,
      );
      return;
    }
    if (orchestrator.NetworkSettings?.Networks?.[networkName]?.EndpointID) {
      return;
    }

    // Network attachment APIs can require the full ID even if inspect accepts a short ID.
    await this.connectContainerToNetwork(orchestrator.Id, networkName);
  }

  async getContainerIpOnNetwork(containerId: string, networkName: string) {
    const inspect = await this.engine.coalesceRead(
      `container-inspect:${containerId}`,
      () => this.engine.docker.getContainer(containerId).inspect(),
      `Inspect container ${containerId} on network ${networkName}`,
    );
    return inspect.NetworkSettings?.Networks?.[networkName]?.IPAddress || null;
  }

  /**
   * Reads the container IP from a specific Docker network attachment.
   */
  async getContainerIp(containerId: string, networkName: string) {
    const inspect = await this.engine.coalesceRead(
      `container-inspect:${containerId}`,
      () => this.engine.docker.getContainer(containerId).inspect(),
      `Inspect container ${containerId} on network ${networkName}`,
    );
    return inspect.NetworkSettings.Networks?.[networkName]?.IPAddress || null;
  }

  /**
   * Returns the gateway IP advertised by the app network, if Docker exposed one.
   */
  async getNetworkGateway(networkName: string) {
    const network = await this.engine.read(
      () => this.engine.docker.getNetwork(networkName).inspect(),
      `Inspect network ${networkName}`,
    );
    return network.IPAM?.Config?.find((item) => item.Gateway)?.Gateway ?? null;
  }

  async getManagedIpv4Subnet(applicationId: string, networkName: string) {
    const inspect = await this.inspectNetworkIfPresent(networkName);
    const [subnet] = inspect?.IPAM?.Config ?? [];
    const cidr = subnet?.Subnet ? normalizeIpv4Cidr(subnet.Subnet) : null;
    if (
      !inspect ||
      !this.isManagedAppNetwork(inspect.Labels, applicationId) ||
      inspect.EnableIPv6 ||
      inspect.IPAM?.Config?.length !== 1 ||
      !cidr ||
      cidr.endsWith('/0')
    ) {
      throw new Error(
        'Restricted startup requires a managed network with one IPv4 subnet.',
      );
    }
    return cidr;
  }

  /**
   * Resolves the orchestrator container IP on the app network when attached.
   * Missing orchestrator metadata is treated as unavailable instead of an error.
   */
  async getOrchestratorIp(networkName: string) {
    try {
      const orchestrator = await this.inspectOrchestratorContainer();
      return (
        orchestrator?.NetworkSettings?.Networks?.[networkName]?.IPAddress ||
        null
      );
    } catch {
      return null;
    }
  }

  private async inspectOrchestratorContainer() {
    const hostname = this.engine.orchestratorHostname;
    try {
      const inspect = await this.engine.coalesceRead(
        'orchestrator-container-inspect',
        () => this.engine.docker.getContainer(hostname).inspect(),
        'Inspect orchestrator container by hostname',
      );
      return inspect.Id.startsWith(hostname) ||
        inspect.Config?.Hostname === hostname
        ? inspect
        : null;
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) return null;
      throw error;
    }
  }

  async connectContainerToNetwork(
    containerId: string,
    networkName: string,
    timings?: DockerNetworkAttachmentTimings,
    options?: DockerOperationOptions,
  ) {
    const network = this.engine.docker.getNetwork(networkName);
    const queuedAt = performance.now();
    let dispatched = false;
    let admitted = false;
    try {
      await this.engine.mutate(
        async () => {
          admitted = true;
          if (timings)
            timings.dockerMutationQueueMs += Math.round(
              performance.now() - queuedAt,
            );
          options?.signal?.throwIfAborted();
          options?.deadline?.throwIfExpired();
          const observation: DockerNetworkConnectObservation = {
            requestId: randomUUID(),
            containerId,
            networkName,
            transport: this.engine.transport,
            dispatchedAt: new Date().toISOString(),
            outcome: 'pending',
          };
          if (timings) timings.networkConnect = observation;
          this.logger.debug({
            event: 'docker_network_connect_dispatched',
            ...observation,
          });
          const connectedAt = performance.now();
          try {
            dispatched = true;
            await network.connect({ Container: containerId });
            observation.outcome = 'fulfilled';
          } catch (error) {
            observation.outcome = 'rejected';
            throw error;
          } finally {
            const elapsedMs = Math.round(performance.now() - connectedAt);
            observation.settledAt = new Date().toISOString();
            this.logger.debug({
              event: 'docker_network_connect_settled',
              ...observation,
              elapsedMs,
            });
            if (timings) timings.networkConnectMs += elapsedMs;
          }
        },
        `Connect container ${containerId} to network ${networkName}`,
        options,
      );
    } catch (error) {
      if (!dispatched) throw error;
      const transportError = this.engine.isTransientDockerTransportError(error);
      if (
        !transportError &&
        !this.engine.isDockerConflict(error) &&
        !this.engine.isContainerAlreadyConnectedToNetwork(error)
      ) {
        throw error;
      }

      const convergenceStartedAt = performance.now();
      try {
        if (transportError) await delay(300);
        if (!(await this.observeNetworkMembership(containerId, networkName))) {
          throw error;
        }
      } finally {
        if (timings)
          timings.networkConvergenceMs += Math.round(
            performance.now() - convergenceStartedAt,
          );
      }
      if (transportError) {
        this.logger.warn(
          `Accepted container ${containerId} network attachment after a transient Docker transport error.`,
        );
      }
    } finally {
      if (!admitted && timings)
        timings.dockerMutationQueueMs += Math.round(
          performance.now() - queuedAt,
        );
    }
  }

  async disconnectContainerFromNetwork(
    containerId: string,
    networkName: string,
  ) {
    const network = this.engine.docker.getNetwork(networkName);
    try {
      await this.engine.mutate(
        () =>
          network.disconnect({
            Container: containerId,
            Force: true,
          }),
        `Disconnect container ${containerId} from network ${networkName}`,
      );
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) return;
      const transportError = this.engine.isTransientDockerTransportError(error);
      if (
        !transportError &&
        !this.engine.isDockerConflict(error) &&
        !this.engine.isContainerAlreadyDisconnectedFromNetwork(error)
      ) {
        throw error;
      }

      if (transportError) await delay(300);
      const attached = await this.observeNetworkMembership(
        containerId,
        networkName,
      );
      if (attached !== false) {
        throw error;
      }
    }
  }

  async removeNetwork(networkName: string, applicationId?: string) {
    const inspect = await this.inspectNetworkIfPresent(networkName);
    if (!inspect) return;
    if (
      applicationId &&
      !this.isManagedAppNetwork(inspect.Labels, applicationId)
    ) {
      throw new Error(
        `Docker network ${networkName} is not managed by this application.`,
      );
    }

    await Promise.all(
      Object.keys(inspect.Containers ?? {}).map((containerId) =>
        this.disconnectContainerFromNetwork(containerId, inspect.Id),
      ),
    );

    try {
      await this.engine.mutate(
        () => this.engine.docker.getNetwork(inspect.Id).remove(),
        `Remove network ${networkName}`,
      );
    } catch (error) {
      if (!this.engine.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  async listNetworkContainerIds(networkName: string) {
    const inspect = await this.inspectNetworkIfPresent(networkName);
    return Object.keys(inspect?.Containers ?? {});
  }

  private async observeNetworkMembership(
    containerId: string,
    networkName: string,
  ) {
    const inspect = await this.inspectNetworkIfPresent(networkName).catch(
      () => undefined,
    );
    if (inspect === undefined) return undefined;
    return Object.hasOwn(inspect?.Containers ?? {}, containerId);
  }

  private async inspectNetworkIfPresent(networkName: string) {
    try {
      return await this.engine.read(
        () => this.engine.docker.getNetwork(networkName).inspect(),
        `Inspect network ${networkName}`,
      );
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  private async findNetworkByName(name: string) {
    const networks = await this.engine.read(
      () =>
        this.engine.docker.listNetworks({
          filters: { name: [name] },
        }),
      `List networks while finding ${name}`,
    );
    const network = networks.find((item) => item.Name === name);
    return network ? this.engine.docker.getNetwork(network.Id) : undefined;
  }

  private async createNetwork(applicationId: string, networkName: string) {
    return this.engine.mutate(
      () =>
        this.engine.docker.createNetwork({
          Name: networkName,
          Internal: false,
          CheckDuplicate: true,
          Labels: this.engine.labels(applicationId, 'network'),
        }),
      `Create network ${networkName}`,
    );
  }

  private async ensureRoutableNetwork(
    applicationId: string,
    networkName: string,
    network: ReturnType<DockerEngineService['docker']['getNetwork']>,
  ) {
    const inspect = await this.engine.read(
      () => network.inspect(),
      `Inspect network ${networkName}`,
    );
    if (!inspect.Internal) {
      return network;
    }

    if (!this.isManagedAppNetwork(inspect.Labels, applicationId)) {
      throw new Error(
        `Docker network ${networkName} is internal and is not managed by this application. Remove or rename it before provisioning so containers can use normal Docker egress.`,
      );
    }

    const attachedContainerIds = Object.keys(inspect.Containers ?? {});
    if (attachedContainerIds.length > 0) {
      throw new Error(
        `Docker network ${networkName} is internal, so containers on it cannot use internet or external DNS. Stop and recreate this app so Rebroid can create a routable network.`,
      );
    }

    this.logger.warn(
      `Recreating stale internal app network ${networkName} so containers can use normal Docker egress.`,
    );
    await this.engine.mutate(
      () => network.remove(),
      `Remove stale network ${networkName}`,
    );
    return this.createNetwork(applicationId, networkName);
  }

  private isManagedAppNetwork(
    labels: Record<string, string> | undefined,
    applicationId: string,
  ) {
    return (
      labels?.['com.rebroid.managed'] === 'true' &&
      labels['com.rebroid.application-id'] === applicationId &&
      labels['com.rebroid.component'] === 'network'
    );
  }
}
