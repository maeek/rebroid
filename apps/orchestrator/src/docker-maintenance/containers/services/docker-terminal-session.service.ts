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
import { streamDockerTerminal } from './docker-terminal-stream';

const idleMs = 5 * 60_000;
const sessionMs = 30 * 60_000;
const recheckMs = 5_000;

export type DockerTerminalTarget = {
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
    reauthorize: (
      signal: AbortSignal,
    ) => Promise<DockerTerminalIdentity | null>,
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
    const end = (reason: string) => controller.abort(reason);
    const disconnected = () => end('disconnected');
    const setupTimeout = setTimeout(() => end('setup_timeout'), 8_000);
    const lifetime = setTimeout(() => end('session_timeout'), sessionMs);
    const idle = setTimeout(() => end('idle_timeout'), idleMs);
    let heartbeat = true;
    const pong = () => {
      heartbeat = true;
    };
    let renewing = false;
    const recheck = setInterval(() => {
      if (signal.aborted || socket.readyState !== 1) return;
      if (!heartbeat) return end('disconnected');
      heartbeat = false;
      socket.ping(undefined, undefined, (error) => {
        if (error) disconnected();
      });
      if (renewing) return;
      renewing = true;
      void reauthorize(signal)
        .then((current) => {
          if (
            current?.userId !== identity.userId ||
            current.accountSessionId !== identity.accountSessionId
          ) {
            end('revoked');
          }
        })
        .catch(() => end('revoked'))
        .finally(() => {
          renewing = false;
        });
    }, recheckMs);
    const stopSocket = () => {
      if (socket.readyState !== 1) return;
      if (signal.reason === 'revoked') {
        socket.close(1008, 'Terminal access was revoked.');
      } else if (
        signal.reason === 'idle_timeout' ||
        signal.reason === 'session_timeout'
      ) {
        socket.close(1000, 'Terminal session timed out.');
      } else if (signal.reason === 'setup_timeout') {
        socket.close(1011, 'Terminal setup timed out.');
      } else {
        socket.close(1000, 'Terminal session closed.');
      }
    };
    const earlyMessage = () => end('protocol_error');
    this.sessions.set(controller, identity.userId);
    socket.once('close', disconnected);
    socket.once('error', disconnected);
    socket.on('pong', pong);
    socket.on('message', earlyMessage);
    signal.addEventListener('abort', stopSocket, { once: true });

    let opened = false;
    let cleanupFailed = false;
    try {
      const inspect = await this.containers.inspectContainer(containerId, {
        signal,
      });
      const labels = inspect.Config.Labels ?? {};
      const applicationId = labels['com.rebroid.application-id'];
      if (
        inspect.Id !== containerId ||
        inspect.State.StartedAt !== startedAt ||
        !inspect.State.Running ||
        inspect.State.Paused ||
        inspect.State.Restarting ||
        labels['com.rebroid.managed'] !== 'true' ||
        labels['com.rebroid.component'] !== 'runtime' ||
        !applicationId
      ) {
        socket.close(1008, 'This managed runtime is no longer available.');
        return;
      }
      await this.applications.withPlatformContainerTerminal(
        applicationId,
        containerId,
        startedAt,
        controller,
        async () => {
          const current = await reauthorize(signal);
          if (
            current?.userId !== identity.userId ||
            current.accountSessionId !== identity.accountSessionId
          ) {
            end('revoked');
          }
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
          clearTimeout(setupTimeout);
          let exitCode: number | null;
          try {
            socket.off('message', earlyMessage);
            await streamDockerTerminal(socket, terminal, signal, () =>
              idle.refresh(),
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
      clearInterval(recheck);
      clearTimeout(setupTimeout);
      clearTimeout(idle);
      clearTimeout(lifetime);
      signal.removeEventListener('abort', stopSocket);
      socket.off('message', earlyMessage);
      socket.off('pong', pong);
      socket.off('close', disconnected);
      socket.off('error', disconnected);
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
}
