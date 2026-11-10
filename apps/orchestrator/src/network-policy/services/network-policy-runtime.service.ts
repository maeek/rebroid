import { Inject, Injectable } from '@nestjs/common';
import type { ContainerInspectInfo } from 'dockerode';
import { isIPv4 } from 'node:net';
import type {
  NetworkPolicyTarget,
  RestrictedRuntimePolicyTarget,
} from '../../android-apps/contracts/android-apps-runtime-inventory.port';
import { getErrorMessage } from '../../common/error-message';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../docker/contracts/docker-container-lifecycle.port';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../docker/contracts/docker-engine.port';

type PolicyRuntimeObservation =
  | { state: 'inactive' }
  | { state: 'uncertain'; reason: string }
  | { state: 'live'; address: string | null };

function hasManagedRuntimeLabels(inspect: ContainerInspectInfo, appId: string) {
  const labels = inspect.Config?.Labels;
  return (
    labels?.['com.rebroid.managed'] === 'true' &&
    labels['com.rebroid.application-id'] === appId &&
    labels['com.rebroid.component'] === 'runtime'
  );
}

@Injectable()
export class NetworkPolicyRuntimeService {
  constructor(
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly containers: DockerContainerLifecyclePort,
    @Inject(DOCKER_ENGINE)
    private readonly engine: DockerEnginePort,
  ) {}

  async getContainerIp(app: NetworkPolicyTarget) {
    if (!app.containerId) return null;
    const inspect = await this.containers.inspectContainer(app.containerId);
    if (!hasManagedRuntimeLabels(inspect, app.id)) {
      throw new Error('Managed container identity validation failed.');
    }
    return (
      inspect.NetworkSettings?.Networks?.[app.networkName]?.IPAddress || null
    );
  }

  async observeStartupRuntime(
    app: RestrictedRuntimePolicyTarget,
  ): Promise<PolicyRuntimeObservation> {
    let inspect: ContainerInspectInfo;
    try {
      inspect = await this.containers.inspectContainer(app.containerId);
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) return { state: 'inactive' };
      return { state: 'uncertain', reason: getErrorMessage(error) };
    }

    if (
      inspect.Id !== app.containerId ||
      !hasManagedRuntimeLabels(inspect, app.id)
    ) {
      return {
        state: 'uncertain',
        reason: 'Managed container identity validation failed.',
      };
    }
    const state = inspect.State;
    if (
      state?.Running === true &&
      state.Status === 'running' &&
      !state.Paused &&
      !state.Restarting &&
      !state.Dead
    ) {
      const address =
        inspect.NetworkSettings?.Networks?.[app.networkName]?.IPAddress;
      return {
        state: 'live',
        address: address && isIPv4(address) ? address : null,
      };
    }
    if (
      state?.Running === false &&
      !state.Paused &&
      !state.Restarting &&
      (state.Status === 'created' || state.Status === 'exited')
    ) {
      return { state: 'inactive' };
    }
    return {
      state: 'uncertain',
      reason: 'Container state is not confirmed live or stopped.',
    };
  }
}
