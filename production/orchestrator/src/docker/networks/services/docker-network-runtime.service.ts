import { Injectable, Logger } from '@nestjs/common';
import { DockerEngineService } from '../../docker-engine.service';

@Injectable()
export class DockerNetworkRuntimeService {
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
    if (!this.engine.orchestratorContainerId) {
      this.logger.warn(
        `ORCHESTRATOR_CONTAINER_ID is not set; scrcpy proxying requires another path to reach ${networkName}.`,
      );
      return;
    }

    await this.connectContainerToNetwork(
      this.engine.orchestratorContainerId,
      networkName,
    );
  }

  async getContainerIpOnNetwork(containerId: string, networkName: string) {
    const inspect = await this.engine.docker
      .getContainer(containerId)
      .inspect();
    return inspect.NetworkSettings?.Networks?.[networkName]?.IPAddress || null;
  }

  /**
   * Reads the container IP from a specific Docker network attachment.
   */
  async getContainerIp(containerId: string, networkName: string) {
    const inspect = await this.engine.docker
      .getContainer(containerId)
      .inspect();
    return inspect.NetworkSettings.Networks?.[networkName]?.IPAddress || null;
  }

  /**
   * Returns the gateway IP advertised by the app network, if Docker exposed one.
   */
  async getNetworkGateway(networkName: string) {
    const network = await this.engine.docker.getNetwork(networkName).inspect();
    return network.IPAM?.Config?.find((item) => item.Gateway)?.Gateway ?? null;
  }

  /**
   * Resolves the orchestrator container IP on the app network when attached.
   * Missing orchestrator metadata is treated as unavailable instead of an error.
   */
  async getOrchestratorIp(networkName: string) {
    if (!this.engine.orchestratorContainerId) {
      return null;
    }

    try {
      const inspect = await this.engine.docker
        .getContainer(this.engine.orchestratorContainerId)
        .inspect();
      return inspect.NetworkSettings.Networks?.[networkName]?.IPAddress || null;
    } catch {
      return null;
    }
  }

  async connectContainerToNetwork(containerId: string, networkName: string) {
    const network = this.engine.docker.getNetwork(networkName);
    try {
      await network.connect({
        Container: containerId,
      });
    } catch (error) {
      if (
        this.engine.isDockerConflict(error) ||
        this.engine.isContainerAlreadyConnectedToNetwork(error)
      ) {
        return;
      }

      throw error;
    }
  }

  async disconnectContainerFromNetwork(
    containerId: string,
    networkName: string,
  ) {
    const network = this.engine.docker.getNetwork(networkName);
    try {
      await network.disconnect({
        Container: containerId,
        Force: true,
      });
    } catch (error) {
      if (
        this.engine.isDockerNotFound(error) ||
        this.engine.isContainerAlreadyDisconnectedFromNetwork(error)
      ) {
        return;
      }

      throw error;
    }
  }

  async removeNetwork(networkName: string) {
    const attachedContainerIds =
      await this.listNetworkContainerIds(networkName);

    await Promise.all(
      attachedContainerIds.map((containerId) =>
        this.disconnectContainerFromNetwork(containerId, networkName),
      ),
    );

    try {
      await this.engine.docker.getNetwork(networkName).remove();
    } catch (error) {
      if (!this.engine.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  async listNetworkContainerIds(networkName: string) {
    try {
      const inspect = await this.engine.docker
        .getNetwork(networkName)
        .inspect();
      return Object.keys(inspect.Containers ?? {});
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) {
        return [];
      }

      throw error;
    }
  }

  private async findNetworkByName(name: string) {
    const networks = await this.engine.docker.listNetworks({
      filters: { name: [name] },
    });
    const network = networks.find((item) => item.Name === name);
    return network ? this.engine.docker.getNetwork(network.Id) : undefined;
  }

  private async createNetwork(applicationId: string, networkName: string) {
    return this.engine.docker.createNetwork({
      Name: networkName,
      Internal: false,
      CheckDuplicate: true,
      Labels: this.engine.labels(applicationId, 'network'),
    });
  }

  private async ensureRoutableNetwork(
    applicationId: string,
    networkName: string,
    network: ReturnType<DockerEngineService['docker']['getNetwork']>,
  ) {
    const inspect = await network.inspect();
    if (!inspect.Internal) {
      return network;
    }

    const labels = inspect.Labels ?? {};
    const isManagedNetwork =
      labels['com.rebroid.managed'] === 'true' &&
      labels['com.rebroid.application-id'] === applicationId &&
      labels['com.rebroid.component'] === 'network';
    if (!isManagedNetwork) {
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
    await network.remove();
    return this.createNetwork(applicationId, networkName);
  }
}
