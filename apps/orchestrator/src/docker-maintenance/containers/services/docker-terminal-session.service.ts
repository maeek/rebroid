import {
  Inject,
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import type { WebSocket } from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { AndroidAppsFacadeService } from '../../../android-apps/common/services/android-apps-facade.service';
import {
  DOCKER_CONTAINER_TERMINAL,
  type DockerContainerTerminalPort,
} from '../../../docker/contracts/docker-container-terminal.port';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import type { DockerTerminalIdentity } from './docker-terminal-authorization.service';
import {
  monitorDockerTerminalSession,
  type ReauthorizeDockerTerminal,
} from './docker-terminal-session-monitor';
import { streamDockerTerminal } from './docker-terminal-stream';

type DockerTerminalTarget = {
  containerId: string;
  startedAt: string;
  user?: string;
};

@Injectable()
export class DockerTerminalSessionService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(DockerTerminalSessionService.name);
  private readonly sessions = new Map<AbortController, string>();

  constructor(
    @Inject(DOCKER_CONTAINER_TERMINAL)
    private readonly terminals: DockerContainerTerminalPort,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly containers: DockerContainerLifecyclePort,
    private readonly applications: AndroidAppsFacadeService,
  ) {}

  async beforeApplicationShutdown() {
    for (const controller of this.sessions.keys()) controller.abort('shutdown');
    const deadline = performance.now() + 10_000;
    while (this.sessions.size && performance.now() < deadline) await delay(50);
  }

  async connect(
    socket: WebSocket,
    target: DockerTerminalTarget,
    identity: DockerTerminalIdentity,
    reauthorize: ReauthorizeDockerTerminal,
  ) {
    if (
      this.sessions.size >= 16 ||
      [...this.sessions.values()].filter((id) => id === identity.userId)
        .length >= 2
    ) {
      socket.close(1013, 'Terminal session limit reached.');
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const { containerId, startedAt, user } = target;
    const metadata = {
      terminalId: randomUUID(),
      actorUserId: identity.userId,
      containerId,
      containerUser: user,
    };
    this.sessions.set(controller, identity.userId);
    const monitor = monitorDockerTerminalSession(
      socket,
      controller,
      identity,
      reauthorize,
    );

    let opened = false;
    let cleanupFailed = false;
    try {
      const applicationId = await this.findRuntimeApplication(target, signal);
      if (!applicationId) {
        socket.close(1008, 'This managed runtime is no longer available.');
        return;
      }
      await this.applications.withPlatformContainerTerminal(
        applicationId,
        containerId,
        startedAt,
        controller,
        async () => {
          await monitor.verifyIdentity();
          signal.throwIfAborted();
          const terminal = await this.terminals.open(
            containerId,
            startedAt,
            user,
            signal,
          );
          opened = true;
          this.logger.log({
            event: 'docker.container.terminal.open',
            ...metadata,
          });
          let exitCode: number | null;
          try {
            monitor.startStreaming();
            await streamDockerTerminal(
              socket,
              terminal,
              signal,
              monitor.onInput,
            );
          } finally {
            exitCode = await terminal.close().catch(() => {
              cleanupFailed = true;
              return null;
            });
          }
          if (socket.readyState === 1) {
            if (cleanupFailed) {
              socket.close(
                1011,
                'Terminal process cleanup could not be verified.',
              );
              return;
            }
            socket.send(JSON.stringify({ type: 'exit', code: exitCode }));
            socket.close(1000, 'Shell exited.');
          }
        },
      );
    } catch {
      if (socket.readyState === 1) {
        socket.close(
          1011,
          opened
            ? 'Terminal session failed.'
            : 'Could not open shell for the selected container user.',
        );
      }
    } finally {
      monitor.dispose();
      this.sessions.delete(controller);
      const outcome: unknown = cleanupFailed
        ? 'cleanup_failed'
        : (signal.reason ?? (opened ? 'closed' : 'denied'));
      const event = {
        event: 'docker.container.terminal.close',
        ...metadata,
        outcome: typeof outcome === 'string' ? outcome : 'runtime_changed',
      };
      if (cleanupFailed) this.logger.error(event);
      else this.logger.log(event);
    }
  }

  private async findRuntimeApplication(
    { containerId, startedAt }: DockerTerminalTarget,
    signal: AbortSignal,
  ) {
    const inspect = await this.containers.inspectContainer(containerId, {
      signal,
    });
    const labels = inspect.Config.Labels ?? {};
    if (
      inspect.Id !== containerId ||
      inspect.State.StartedAt !== startedAt ||
      !inspect.State.Running ||
      inspect.State.Paused ||
      inspect.State.Restarting ||
      labels['com.rebroid.managed'] !== 'true' ||
      labels['com.rebroid.component'] !== 'runtime'
    ) {
      return null;
    }
    return labels['com.rebroid.application-id'] || null;
  }
}
