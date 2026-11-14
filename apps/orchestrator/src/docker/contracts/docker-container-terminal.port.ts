import type { Duplex } from 'node:stream';

export const DOCKER_CONTAINER_TERMINAL = Symbol('DOCKER_CONTAINER_TERMINAL');

export interface DockerContainerTerminalPort {
  open(
    containerId: string,
    startedAt: string,
    user: string | undefined,
    signal: AbortSignal,
  ): Promise<DockerContainerTerminal>;
}

export interface DockerContainerTerminal {
  stream: Duplex;
  resize(cols: number, rows: number): Promise<void>;
  close(): Promise<number | null>;
}
