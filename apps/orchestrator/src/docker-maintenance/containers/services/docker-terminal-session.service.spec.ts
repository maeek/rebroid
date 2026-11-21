import type { WebSocket } from '@fastify/websocket';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { AndroidAppsFacadeService } from '../../../android-apps/common/services/android-apps-facade.service';
import type { DockerContainerLifecyclePort } from '../../../docker/contracts/docker-container-lifecycle.port';
import { DockerTerminalSessionService } from './docker-terminal-session.service';

const identity = { userId: 'user-1', accountSessionId: 'session-1' };
const target = { containerId: 'container-1', startedAt: 'started' };

function setup() {
  let markReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  const socket = Object.assign(new EventEmitter(), {
    readyState: 1,
    close: jest.fn(() => {
      socket.readyState = 2;
    }),
    ping: jest.fn(),
    send: jest.fn((frame: string) => {
      if (frame === JSON.stringify({ type: 'ready' })) markReady();
    }),
  });
  const stream = new PassThrough();
  const close = jest.fn().mockResolvedValue(0);
  const open = jest
    .fn()
    .mockResolvedValue({ stream, close, resize: jest.fn() });
  const inspectContainer = jest.fn().mockResolvedValue({
    Id: target.containerId,
    State: { StartedAt: target.startedAt, Running: true },
    Config: {
      Labels: {
        'com.rebroid.application-id': 'app-1',
        'com.rebroid.managed': 'true',
        'com.rebroid.component': 'runtime',
      },
    },
  });
  const service = new DockerTerminalSessionService(
    { open },
    { inspectContainer } as unknown as DockerContainerLifecyclePort,
    {
      withPlatformContainerTerminal: async (
        _app: string,
        _id: string,
        _started: string,
        _controller: AbortController,
        operation: () => Promise<void>,
      ) => operation(),
    } as AndroidAppsFacadeService,
  );
  const reauthorize = jest.fn().mockResolvedValue(identity);
  return {
    socket,
    stream,
    open,
    close,
    inspectContainer,
    reauthorize,
    ready,
    connect: () =>
      service.connect(
        socket as unknown as WebSocket,
        target,
        identity,
        reauthorize,
      ),
  };
}

describe('DockerTerminalSessionService', () => {
  beforeEach(() =>
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }),
  );
  afterEach(() => jest.useRealTimers());

  it('closes an open terminal when the account session changes', async () => {
    const session = setup();
    const connected = session.connect();
    await session.ready;
    session.reauthorize.mockResolvedValue({
      ...identity,
      accountSessionId: 'session-2',
    });
    await jest.advanceTimersByTimeAsync(5_000);
    await connected;
    expect(session.socket.close).toHaveBeenCalledWith(
      1008,
      'Terminal access was revoked.',
    );
    expect(session.close).toHaveBeenCalledTimes(1);
    expect(session.socket.eventNames()).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels stalled setup before opening a shell', async () => {
    const session = setup();
    session.inspectContainer.mockImplementation(
      (_id: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          }),
        ),
    );
    const connected = session.connect();
    await jest.advanceTimersByTimeAsync(8_000);
    await connected;
    expect(session.socket.close).toHaveBeenCalledWith(
      1011,
      'Terminal setup timed out.',
    );
    expect(session.open).not.toHaveBeenCalled();
    expect(session.socket.eventNames()).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports failed process cleanup to the socket without a successful exit frame', async () => {
    const session = setup();
    session.close.mockRejectedValue(new Error('cleanup failed'));
    const connected = session.connect();
    await session.ready;
    session.stream.end();
    await connected;
    expect(session.socket.close).toHaveBeenCalledWith(
      1011,
      'Terminal process cleanup could not be verified.',
    );
    expect(session.socket.send.mock.calls).toEqual([
      [JSON.stringify({ type: 'ready' })],
    ]);
    expect(session.socket.eventNames()).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
