import type { DockerEngineService } from '../docker-engine.service';

export const DOCKER_ENGINE = Symbol('DOCKER_ENGINE');

export type DockerEnginePort = Pick<
  DockerEngineService,
  keyof DockerEngineService
>;
