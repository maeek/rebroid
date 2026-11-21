import type { WebSocket } from '@fastify/websocket';
import type { DockerTerminalIdentity } from './docker-terminal-authorization.service';

const setupMs = 8_000;
const idleMs = 5 * 60_000;
const sessionMs = 30 * 60_000;
const recheckMs = 5_000;

export type ReauthorizeDockerTerminal = (
  signal: AbortSignal,
) => Promise<DockerTerminalIdentity | null>;

function closeAbortedSocket(socket: WebSocket, reason: unknown) {
  if (socket.readyState !== 1) return;
  switch (reason) {
    case 'revoked':
      return socket.close(1008, 'Terminal access was revoked.');
    case 'idle_timeout':
    case 'session_timeout':
      return socket.close(1000, 'Terminal session timed out.');
    case 'setup_timeout':
      return socket.close(1011, 'Terminal setup timed out.');
    default:
      return socket.close(1000, 'Terminal session closed.');
  }
}

export function monitorDockerTerminalSession(
  socket: WebSocket,
  controller: AbortController,
  identity: DockerTerminalIdentity,
  reauthorize: ReauthorizeDockerTerminal,
) {
  const { signal } = controller;
  const verifyIdentity = async () => {
    const current = await reauthorize(signal);
    if (
      current?.userId !== identity.userId ||
      current.accountSessionId !== identity.accountSessionId
    ) {
      controller.abort('revoked');
    }
  };

  const setup = setTimeout(() => controller.abort('setup_timeout'), setupMs);
  const lifetime = setTimeout(
    () => controller.abort('session_timeout'),
    sessionMs,
  );
  const idle = setTimeout(() => controller.abort('idle_timeout'), idleMs);
  const disconnected = () => controller.abort('disconnected');
  const earlyMessage = () => controller.abort('protocol_error');
  const stopSocket = () => closeAbortedSocket(socket, signal.reason);
  let heartbeat = true;
  const pong = () => {
    heartbeat = true;
  };
  let renewing = false;
  const recheck = setInterval(() => {
    if (signal.aborted || socket.readyState !== 1) return;
    if (!heartbeat) return disconnected();
    heartbeat = false;
    socket.ping(undefined, undefined, (error) => {
      if (error) disconnected();
    });
    if (renewing) return;
    renewing = true;
    void verifyIdentity()
      .catch(() => controller.abort('revoked'))
      .finally(() => {
        renewing = false;
      });
  }, recheckMs);

  socket.once('close', disconnected);
  socket.once('error', disconnected);
  socket.on('pong', pong);
  socket.on('message', earlyMessage);
  signal.addEventListener('abort', stopSocket, { once: true });

  return {
    verifyIdentity,
    startStreaming() {
      clearTimeout(setup);
      socket.off('message', earlyMessage);
    },
    onInput() {
      idle.refresh();
    },
    dispose() {
      clearInterval(recheck);
      clearTimeout(setup);
      clearTimeout(idle);
      clearTimeout(lifetime);
      signal.removeEventListener('abort', stopSocket);
      socket.off('message', earlyMessage);
      socket.off('pong', pong);
      socket.off('close', disconnected);
      socket.off('error', disconnected);
    },
  };
}
