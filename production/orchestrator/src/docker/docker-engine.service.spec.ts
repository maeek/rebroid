import { ConfigService } from '@nestjs/config';
import { DockerEngineService } from './docker-engine.service';

const createEngine = () =>
  new DockerEngineService({
    getOrThrow: (key: string) => {
      const values: Record<string, string | number> = {
        'app.docker.socketPath': '/var/run/docker.sock',
        'app.docker.requestTimeoutMs': 15_000,
        'app.docker.connectionTimeoutMs': 5_000,
        'app.docker.maxConcurrentReads': 2,
        'app.docker.resourcePrefix': 'rebroid',
      };
      return values[key];
    },
    get: () => undefined,
  } as unknown as ConfigService);

describe('DockerEngineService', () => {
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
});
