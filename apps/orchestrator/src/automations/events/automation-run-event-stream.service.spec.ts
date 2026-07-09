import { EventEmitter } from 'node:events';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AutomationRunEventStreamService } from './automation-run-event-stream.service';

type StreamHandler = (
  socket: EventEmitter & {
    readyState: number;
    send: jest.Mock;
    close: jest.Mock;
  },
  request: { url: string },
) => Promise<void>;

const registerHandler = async (service: AutomationRunEventStreamService) => {
  let handler: StreamHandler | null = null;
  const fastify = {
    register: jest.fn().mockResolvedValue(undefined),
    get: jest.fn((_path: string, _options: object, value: StreamHandler) => {
      handler = value;
    }),
  };
  await service.register(fastify as never);
  if (!handler) throw new Error('WebSocket handler was not registered.');
  return handler as StreamHandler;
};

const createSocket = () =>
  Object.assign(new EventEmitter(), {
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
  });

describe('AutomationRunEventStreamService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('expires tokens, consumes them once, and enforces bounded capacity', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const service = new AutomationRunEventStreamService({} as never);
    const first = service.createSubscribeToken('owner-1', 'run-1');
    const consume = (
      service as unknown as {
        consumeToken(token: string): { runId: string };
      }
    ).consumeToken.bind(service);
    expect(consume(first.token).runId).toBe('run-1');
    expect(() => consume(first.token)).toThrow(UnauthorizedException);

    const expired = service.createSubscribeToken('owner-1', 'run-1');
    jest.advanceTimersByTime(60_001);
    service.createSubscribeToken('owner-1', 'run-2');
    expect(() => consume(expired.token)).toThrow(UnauthorizedException);

    for (let index = 1; index < 10_000; index += 1) {
      service.createSubscribeToken('owner-1', `run-${index}`);
    }
    expect(() => service.createSubscribeToken('owner-1', 'overflow')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('cleans up subscriptions and closes sockets when setup fails', async () => {
    const unsubscribe = jest.fn();
    const events = {
      subscribeWithReplay: jest
        .fn()
        .mockResolvedValueOnce(unsubscribe)
        .mockRejectedValueOnce(new Error('replay failed')),
    };
    const service = new AutomationRunEventStreamService(events as never);
    const handler = await registerHandler(service);

    const firstToken = service.createSubscribeToken('owner-1', 'run-1');
    const firstSocket = createSocket();
    await handler(firstSocket, { url: `/?token=${firstToken.token}` });
    firstSocket.emit('close');
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    const secondToken = service.createSubscribeToken('owner-1', 'run-2');
    const secondSocket = createSocket();
    await expect(
      handler(secondSocket, { url: `/?token=${secondToken.token}` }),
    ).rejects.toThrow('replay failed');
    expect(secondSocket.close).toHaveBeenCalledWith(
      1011,
      'Automation event stream setup failed.',
    );
  });

  it('streams replay callbacks, heartbeats, and handles an early close', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const unsubscribe = jest.fn();
    let resolveSubscription!: (unsubscribe: () => void) => void;
    const subscription = new Promise<() => void>((resolve) => {
      resolveSubscription = resolve;
    });
    const events = {
      subscribeWithReplay: jest
        .fn()
        .mockImplementationOnce(
          async (
            _owner: string,
            _run: string,
            _after: number,
            listener: (value: object) => void,
          ) => {
            listener({ sequence: 1 });
            return unsubscribe;
          },
        )
        .mockReturnValueOnce(subscription),
    };
    const service = new AutomationRunEventStreamService(events as never);
    const handler = await registerHandler(service);

    const token = service.createSubscribeToken('owner-1', 'run-1');
    const socket = createSocket();
    await handler(socket, { url: `/?token=${token.token}&after=invalid` });
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'event', event: { sequence: 1 } }),
    );
    jest.advanceTimersByTime(15_000);
    expect(socket.send).toHaveBeenCalledWith(
      expect.stringContaining('heartbeat'),
    );
    socket.emit('error', new Error('closed'));
    socket.emit('close');
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    const earlyToken = service.createSubscribeToken('owner-1', 'run-2');
    const earlySocket = createSocket();
    const setup = handler(earlySocket, { url: `/?token=${earlyToken.token}` });
    earlySocket.emit('close');
    resolveSubscription(unsubscribe);
    await setup;
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('rejects incomplete token records', () => {
    const service = new AutomationRunEventStreamService({} as never);
    const token = service.createSubscribeToken('owner-1', 'run-1');
    const internal = service as unknown as {
      tokens: Map<
        string,
        { ownerUserId: string; runId: string; expiresAt: number }
      >;
      consumeToken(value: string): unknown;
    };
    internal.tokens.set(token.token, {
      ownerUserId: '',
      runId: 'run-1',
      expiresAt: Date.now() + 1_000,
    });
    expect(() => internal.consumeToken(token.token)).toThrow(
      'token is incomplete',
    );
  });

  it('does not send to closed sockets and rejects a missing token', async () => {
    const events = {
      subscribeWithReplay: jest.fn(
        async (
          _owner: string,
          _run: string,
          _after: number,
          listener: (value: object) => void,
        ) => {
          listener({ sequence: 1 });
          return jest.fn();
        },
      ),
    };
    const service = new AutomationRunEventStreamService(events as never);
    const handler = await registerHandler(service);
    const token = service.createSubscribeToken('owner-1', 'run-1');
    const socket = createSocket();
    socket.readyState = 0;

    await handler(socket, { url: `/?token=${token.token}` });
    expect(socket.send).not.toHaveBeenCalled();
    socket.emit('close');

    await expect(handler(createSocket(), { url: '/' })).rejects.toThrow(
      'token is invalid or expired',
    );
  });
});
