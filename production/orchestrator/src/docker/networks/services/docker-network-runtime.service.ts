import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerEngineService } from '../../docker-engine.service';

@Injectable()
export class DockerNetworkRuntimeService {
  private readonly logger = new Logger(DockerNetworkRuntimeService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly engine: DockerEngineService,
  ) {}

  /**
   * Creates the app network if it does not exist already.
   * The network stays Docker-internal only when host-side iptables enforcement is disabled.
   */
  async createIsolatedNetwork(applicationId: string, networkName: string) {
    const existing = await this.findNetworkByName(networkName);
    if (existing) {
      return existing;
    }

    try {
      return await this.engine.docker.createNetwork({
        Name: networkName,
        Internal: !this.config.getOrThrow<boolean>(
          'app.docker.iptablesEnabled',
        ),
        CheckDuplicate: true,
        Labels: this.engine.labels(applicationId, 'network'),
      });
    } catch (error) {
      if (!this.engine.isResourceAlreadyExists(error)) {
        throw error;
      }

      const duplicate = await this.findNetworkByName(networkName);
      if (duplicate) {
        return duplicate;
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
}
