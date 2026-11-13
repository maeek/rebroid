import {
  OperationDeadline,
  OperationDeadlineExceededError,
} from '../common/operation-deadline';
import { ConfigService } from '@nestjs/config';
import {
  dockerConnectionOptions,
  DockerEngineService,
} from './docker-engine.service';
import { MetricsService } from '../metrics/metrics.service';

const createEngine = (
  overrides: Record<string, string | number> = {},
  metrics?: MetricsService,
) =>
  new DockerEngineService(
    {
      getOrThrow: (key: string) => {
        const values: Record<string, string | number> = {
          'app.docker.socketPath': '/var/run/docker.sock',
          'app.docker.requestTimeoutMs': 15_000,
          'app.docker.slowRequestWarningMs': 5_000,
          'app.docker.maxConcurrentReads': 2,
          'app.docker.longOperationTimeoutMs': 30_000,
          'app.docker.maxConcurrentLongOperations': 4,
          'app.docker.resourcePrefix': 'rebroid',
          ...overrides,
        };
        return values[key];
      },
      get: () => undefined,
    } as unknown as ConfigService,
    metrics,
  );

describe('DockerEngineService', () => {
  it('does not apply destructive modem timers to local socket clients', () => {
    expect(
      dockerConnectionOptions(undefined, '/var/run/docker.sock', 60_000),
    ).toEqual({
      options: { socketPath: '/var/run/docker.sock' },
      transport: 'local-socket',
    });
  });

  it('applies the request timeout only to remote control clients', () => {
    expect(
      dockerConnectionOptions('tcp://docker.example:2375', '', 60_000),
    ).toEqual({
      options: {
        protocol: 'http',
        host: 'docker.example',
        port: 2375,
        timeout: 60_000,
      },
      transport: 'remote',
    });
    expect(
      dockerConnectionOptions('tcp://docker.example:2375', '', 60_000, true),
    ).toEqual({
      options: {
        protocol: 'http',
        host: 'docker.example',
        port: 2375,
      },
      transport: 'remote',
    });
  });

  it('retries transient Docker transport errors', async () => {
    const engine = createEngine();
    let attempts = 0;

    await expect(
      engine.read(async () => {
        attempts += 1;
        if (attempts === 1) {
          const error = new Error('socket hang up') as Error & {
            code: string;
          };
          error.code = 'ECONNRESET';
          throw error;
        }
        return 'ok';
      }),
    ).resolves.toBe('ok');
    expect(attempts).toBe(2);
  });

  it('serializes Docker mutations', async () => {
    const engine = createEngine();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = engine.mutate(async () => {
      events.push('first-start');
      await firstGate;
      events.push('first-end');
    });
    const second = engine.mutate(async () => {
      events.push('second');
    });

    await Promise.resolve();
    expect(events).toEqual(['first-start']);
    expect(engine.hasPendingMutations).toBe(true);

    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['first-start', 'first-end', 'second']);
    expect(engine.hasPendingMutations).toBe(false);
  });

  it('limits concurrent Docker reads', async () => {
    const engine = createEngine();
    let active = 0;
    let maxActive = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reads = Array.from({ length: 4 }, () =>
      engine.read(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gate;
        active -= 1;
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(maxActive).toBe(2);
    release();
    await Promise.all(reads);
  });

  it('coalesces identical in-flight Docker reads', async () => {
    const engine = createEngine();
    let release!: (value: string) => void;
    const operation = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const first = engine.coalesceRead('container-inspect:id', operation);
    const second = engine.coalesceRead('container-inspect:id', operation);
    await new Promise((resolve) => setTimeout(resolve, 0));
    release('ok');

    await expect(Promise.all([first, second])).resolves.toEqual(['ok', 'ok']);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry Docker mutations after a transient transport error', async () => {
    const engine = createEngine();
    let attempts = 0;

    await expect(
      engine.mutate(async () => {
        attempts += 1;
        const error = new Error('socket hang up') as Error & {
          code: string;
        };
        error.code = 'ECONNRESET';
        throw error;
      }),
    ).rejects.toThrow('socket hang up');

    expect(attempts).toBe(1);
  });

  it('limits concurrent long Docker operations', async () => {
    const engine = createEngine();
    let active = 0;
    let maxActive = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const operations = Array.from({ length: 6 }, (_, index) =>
      engine.longOperation(
        `long_${index}`,
        `Long operation ${index}`,
        async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await gate;
          active -= 1;
        },
      ),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(maxActive).toBe(4);
    expect(engine.hasPendingDockerWork).toBe(true);
    release();
    await Promise.all(operations);
    expect(engine.hasPendingDockerWork).toBe(false);
  });

  it('aborts timed-out long operations and releases their permit', async () => {
    const engine = createEngine();
    let aborted = false;

    await expect(
      engine.longOperation(
        'exec',
        'Container exec stream',
        async (_docker, signal) =>
          new Promise<never>((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => {
                aborted = true;
                reject(new Error('aborted'));
              },
              { once: true },
            );
          }),
        5,
      ),
    ).rejects.toThrow('Container exec stream timed out after 5ms.');
    expect(aborted).toBe(true);
    expect(engine.hasPendingDockerWork).toBe(false);
  });

  it.each([false, true])(
    'classifies the scope timeout even when the deadline clock still has time remaining (explicit deadline: %s)',
    async (explicitDeadline) => {
      jest.useFakeTimers();
      // Model timer delivery just before the monotonic clock reports expiry.
      const remaining = jest
        .spyOn(OperationDeadline.prototype, 'remainingMs')
        .mockReturnValue(1);
      try {
        const engine = createEngine();
        let aborted = false;
        const operation = engine.longOperation(
          'exec',
          'Container exec stream',
          async (_docker, signal) =>
            new Promise<never>((_resolve, reject) => {
              signal.addEventListener(
                'abort',
                () => {
                  aborted = true;
                  reject(new Error('aborted'));
                },
                { once: true },
              );
            }),
          5,
          explicitDeadline ? { deadline: new OperationDeadline(5) } : undefined,
        );
        const failed = explicitDeadline
          ? expect(operation).rejects.toBeInstanceOf(
              OperationDeadlineExceededError,
            )
          : expect(operation).rejects.toThrow(
              'Container exec stream timed out after 5ms.',
            );
        await jest.advanceTimersByTimeAsync(1);
        await failed;
        expect(aborted).toBe(true);
        expect(engine.hasPendingDockerWork).toBe(false);
        expect(new OperationDeadline(5).remainingMs()).toBe(1);
      } finally {
        remaining.mockRestore();
        jest.useRealTimers();
      }
    },
  );

  it('preserves a caller deadline abort instead of relabeling it as a legacy execution timeout', async () => {
    const engine = createEngine();
    const controller = new AbortController();
    const reason = new OperationDeadlineExceededError();
    const operation = engine.longOperation(
      'exec',
      'Container exec stream',
      async (_docker, signal) => {
        controller.abort(reason);
        signal.throwIfAborted();
      },
      5_000,
      { signal: controller.signal },
    );
    await expect(operation).rejects.toBe(reason);
    expect(engine.hasPendingDockerWork).toBe(false);
  });

  it('warns on slow local reads without destroying them', async () => {
    const metrics = new MetricsService();
    const engine = createEngine(
      { 'app.docker.slowRequestWarningMs': 1 },
      metrics,
    );

    await expect(
      engine.read(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return 'ok';
      }),
    ).resolves.toBe('ok');
    expect(metrics.dockerSnapshot().totals.slow).toBe(1);
  });

  it('sanitizes resource ids from dashboard error events', async () => {
    const metrics = new MetricsService();
    const engine = createEngine({}, metrics);
    const resourceId = 'a'.repeat(64);

    await expect(
      engine.mutate(async () => {
        throw new Error(`Container ${resourceId} failed.`);
      }),
    ).rejects.toThrow(resourceId);
    expect(metrics.dockerSnapshot().events[0]?.error).toBe(
      'Container <resource-id> failed.',
    );
  });
});

describe('Docker startup admission budgets', () => {
  it('observes read admission after queue residence and isolates observer failures', async () => {
    const engine = createEngine({ 'app.docker.maxConcurrentReads': 1 });
    let release!: () => void;
    const first = engine.read(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const observer = jest.fn(() => {
      throw new Error('observer failed');
    });
    const operation = jest.fn().mockResolvedValue('ready');
    const second = engine.read(operation, 'Inspect container startup', {
      onDispatched: observer,
    });
    await Promise.resolve();
    expect(observer).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
    release();
    await first;
    await expect(second).resolves.toBe('ready');
    expect(observer).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('isolates long-operation observer failures from execution', async () => {
    const engine = createEngine();
    const observer = jest.fn(() => {
      throw new Error('observer failed');
    });
    const operation = jest.fn().mockResolvedValue('ready');
    await expect(
      engine.longOperation('probe', 'Probe', operation, 10_000, {
        onDispatched: observer,
      }),
    ).resolves.toBe('ready');
    expect(observer).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('expires a queued mutation without dispatching or incrementing inventory revision', async () => {
    jest.useFakeTimers();
    try {
      const engine = createEngine();
      let release!: () => void;
      const first = engine.mutate(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      await Promise.resolve();
      const revision = engine.currentInventoryRevision;
      const operation = jest.fn().mockResolvedValue(undefined);
      const queued = engine.mutate(operation, 'Connect container queued', {
        deadline: new OperationDeadline(100),
      });
      const rejected = expect(queued).rejects.toBeInstanceOf(
        OperationDeadlineExceededError,
      );
      await jest.advanceTimersByTimeAsync(100);
      await rejected;
      expect(operation).not.toHaveBeenCalled();
      expect(engine.currentInventoryRevision).toBe(revision);
      expect(engine.hasPendingMutations).toBe(true);
      release();
      await first;
      expect(engine.hasPendingMutations).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('charges long-operation queue residence to its caller deadline', async () => {
    jest.useFakeTimers();
    try {
      const engine = createEngine({
        'app.docker.maxConcurrentLongOperations': 1,
      });
      let release!: () => void;
      const first = engine.longOperation(
        'first',
        'First',
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      await jest.advanceTimersByTimeAsync(0);
      const operation = jest.fn().mockResolvedValue(undefined);
      const onDispatched = jest.fn();
      const second = engine.longOperation(
        'second',
        'Second',
        operation,
        10_000,
        { deadline: new OperationDeadline(100), onDispatched },
      );
      const rejected = expect(second).rejects.toBeInstanceOf(
        OperationDeadlineExceededError,
      );
      await jest.advanceTimersByTimeAsync(100);
      await rejected;
      expect(operation).not.toHaveBeenCalled();
      expect(onDispatched).not.toHaveBeenCalled();
      release();
      await first;
      expect(engine.hasPendingDockerWork).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

it('preserves deadline classification when a scoped read expires during retry backoff', async () => {
  jest.useFakeTimers();
  try {
    const engine = createEngine();
    const operation = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
      );
    const read = engine.read(operation, 'Inspect container startup', {
      deadline: new OperationDeadline(100),
    });
    const rejected = expect(read).rejects.toBeInstanceOf(
      OperationDeadlineExceededError,
    );
    await jest.advanceTimersByTimeAsync(100);
    await rejected;
    expect(operation).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it('preserves the full legacy long-operation execution timeout after queue residence', async () => {
  jest.useFakeTimers();
  try {
    const engine = createEngine({
      'app.docker.maxConcurrentLongOperations': 1,
    });
    let release!: () => void;
    const first = engine.longOperation(
      'first',
      'First',
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await jest.advanceTimersByTimeAsync(0);
    const operation = jest.fn(async (_docker: unknown, signal: AbortSignal) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      signal.throwIfAborted();
      return 'complete';
    });
    const second = engine.longOperation(
      'second',
      'Legacy operation',
      operation,
      100,
    );
    const result = expect(second).resolves.toBe('complete');
    await jest.advanceTimersByTimeAsync(250);
    expect(operation).not.toHaveBeenCalled();
    release();
    await first;
    await jest.advanceTimersByTimeAsync(50);
    await result;
    expect(operation).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
