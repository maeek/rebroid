import type { DockerContainerProvisioningService } from '../containers/services/docker-container-provisioning.service';

export const DOCKER_CONTAINER_PROVISIONING = Symbol(
  'DOCKER_CONTAINER_PROVISIONING',
);

export type DockerContainerProvisioningPort = Pick<
  DockerContainerProvisioningService,
  keyof DockerContainerProvisioningService
>;
