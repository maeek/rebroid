import { Inject, Injectable } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { OperationDeadline } from '../../../common/operation-deadline';
import {
  DOCKER_CONTAINER_EXEC,
  type DockerContainerExecPort,
} from '../../../docker/contracts/docker-container-exec.port';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../../docker/contracts/docker-engine.port';
import type { ContainerCommandResult } from '../../../docker/docker.types';

type TcpAdbTarget = { containerId: string; adbPort: number };
const guestTimeoutMs = 10_000;

@Injectable()
export class AndroidAppsTcpAdbService {
  constructor(
    @Inject(DOCKER_CONTAINER_EXEC)
    private readonly exec: DockerContainerExecPort,
    @Inject(DOCKER_ENGINE)
    private readonly engine: DockerEnginePort,
  ) {}

  async prepare(
    target: TcpAdbTarget,
    deadline: OperationDeadline,
    signal?: AbortSignal,
  ): Promise<ContainerCommandResult> {
    if (
      !target.containerId ||
      !Number.isInteger(target.adbPort) ||
      target.adbPort < 1 ||
      target.adbPort > 65_535
    ) {
      throw new Error('A container and valid TCP ADB port are required.');
    }
    const command = [
      'sh',
      '-lc',
      [
        'set -e',
        `port=${target.adbPort}`,
        'persist_port="$(getprop persist.adb.tcp.port 2>/dev/null || true)"',
        'service_port="$(getprop service.adb.tcp.port 2>/dev/null || true)"',
        'adbd_state="$(getprop init.svc.adbd 2>/dev/null || true)"',
        'if { [ "$persist_port" = "$port" ] || [ "$service_port" = "$port" ]; } && [ "$adbd_state" = "running" ]; then',
        '  echo "Redroid TCP ADB already enabled."',
        '  exit 0',
        'fi',
        'setprop persist.adb.tcp.port "$port"',
        'setprop service.adb.tcp.port "$port"',
        '[ "$adbd_state" != "running" ] || stop adbd',
        'start adbd',
        'echo "Redroid TCP ADB enabled and adbd restarted."',
      ].join('\n'),
    ];
    for (let attempt = 1; ; attempt += 1) {
      signal?.throwIfAborted();
      deadline.throwIfExpired();
      try {
        return await this.exec.execInContainerWithOutput(
          target.containerId,
          command,
          {
            deadline,
            signal,
            guestTimeoutMs,
          },
        );
      } catch (error) {
        signal?.throwIfAborted();
        deadline.throwIfExpired();
        if (
          attempt === 3 ||
          !this.engine.isTransientDockerTransportError(error)
        ) {
          throw error;
        }
        await delay(
          Math.min(500 * attempt, deadline.remainingMs()),
          undefined,
          { signal },
        );
      }
    }
  }
}
