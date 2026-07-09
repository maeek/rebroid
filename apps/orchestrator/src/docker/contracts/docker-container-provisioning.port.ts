import type Dockerode from 'dockerode';
import type { ApplicationContainerSpec } from '../docker.types';

export const DOCKER_CONTAINER_PROVISIONING = Symbol(
  'DOCKER_CONTAINER_PROVISIONING',
);

export interface DockerContainerProvisioningPort {
  createApplicationContainer(
    spec: ApplicationContainerSpec,
  ): Promise<Dockerode.Container>;
}
