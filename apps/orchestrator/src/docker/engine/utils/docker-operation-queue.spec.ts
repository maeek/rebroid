import {
  OperationDeadline,
  OperationDeadlineExceededError,
} from '../../../common/operation-deadline';
import { DockerOperationQueue } from './docker-operation-queue';

describe('Docker operation queue reconfiguration', () => {
  it('retains queued work and honors a lower limit without interrupting active operations', async () => {
    const queue = new DockerOperationQueue();
    queue.setConcurrency(2);
    const releases: Array<() => void> = [];
    const started: number[] = [];
    const tasks = [0, 1, 2, 3].map((id) =>
      queue.run(async () => {
        started.push(id);
        await new Promise<void>((resolve) => releases.push(resolve));
        return id;
      }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(started).toEqual([0, 1]);
    queue.setConcurrency(1);
    releases[0]();
    await new Promise((resolve) => setImmediate(resolve));
    expect(started).toEqual([0, 1]);
    releases[1]();
    await new Promise((resolve) => setImmediate(resolve));
    expect(started).toEqual([0, 1, 2]);
    queue.setConcurrency(2);
    await new Promise((resolve) => setImmediate(resolve));
    expect(started).toEqual([0, 1, 2, 3]);
    releases[2]();
    releases[3]();
    expect(await Promise.all(tasks)).toEqual([0, 1, 2, 3]);
  });

  it('continues after rejection and rejects invalid concurrency', async () => {
    const queue = new DockerOperationQueue();
    const failed = queue.run(async () => {
      throw new Error('Docker unavailable');
    });
    const next = queue.run(async () => 'next');
    await expect(failed).rejects.toThrow('Docker unavailable');
    await expect(next).resolves.toBe('next');
    expect(() => queue.setConcurrency(0)).toThrow(RangeError);
    expect(() => queue.setConcurrency(1.5)).toThrow(RangeError);
  });

  it('reserves a slot for foreground reads and removes expired background work', async () => {
    const queue = new DockerOperationQueue();
    queue.setConcurrency(2);
    const signal = new AbortController();
    let release!: () => void;
    const active = queue.runBackground(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      signal.signal,
    );
    const background = jest.fn().mockResolvedValue('late stats');
    const queued = queue.runBackground(background, signal.signal);
    await expect(queue.run(async () => 'inspect')).resolves.toBe('inspect');
    expect(background).not.toHaveBeenCalled();

    const reason = new Error('Stats deadline');
    signal.abort(reason);
    await expect(queued).rejects.toBe(reason);
    release();
    await active;
    await expect(
      queue.runBackground(background, new AbortController().signal),
    ).resolves.toBe('late stats');
    expect(background).toHaveBeenCalledTimes(1);
  });

  it('limits the backlog and dispatches foreground work before queued stats', async () => {
    const queue = new DockerOperationQueue();
    let release!: () => void;
    const active = queue.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const started: string[] = [];
    const stats = Array.from({ length: 32 }, () =>
      queue.runBackground(async () => {
        started.push('stats');
      }, new AbortController().signal),
    );
    await expect(
      queue.runBackground(async () => undefined, new AbortController().signal),
    ).rejects.toThrow('queue is full');
    const inspect = queue.run(async () => {
      started.push('inspect');
    });
    release();
    await Promise.all([active, inspect, ...stats]);
    expect(started[0]).toBe('inspect');
    expect(started).toHaveLength(33);
  });
});

describe('Docker foreground queue admission', () => {
  it('withdraws expired work before its predecessor settles and never dispatches it', async () => {
    jest.useFakeTimers();
    try {
      const queue = new DockerOperationQueue();
      let release!: () => void;
      const first = queue.run(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      await Promise.resolve();
      const operation = jest.fn().mockResolvedValue(undefined);
      const queued = queue.run(operation, {
        deadline: new OperationDeadline(100),
      });
      const rejected = expect(queued).rejects.toBeInstanceOf(
        OperationDeadlineExceededError,
      );
      await jest.advanceTimersByTimeAsync(100);
      await rejected;
      expect(operation).not.toHaveBeenCalled();
      release();
      await first;
      await queue.run(async () => undefined);
      expect(operation).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('withdraws cancelled queued work but retains an admitted operation until it settles', async () => {
    const queue = new DockerOperationQueue();
    const controller = new AbortController();
    let release!: () => void;
    let activeSettled = false;
    const first = queue.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      { signal: controller.signal },
    );
    void first.then(() => {
      activeSettled = true;
    });
    await Promise.resolve();
    const operation = jest.fn().mockResolvedValue(undefined);
    const queued = queue.run(operation, { signal: controller.signal });
    const reason = new Error('cancelled before admission');
    controller.abort(reason);
    await expect(queued).rejects.toBe(reason);
    expect(activeSettled).toBe(false);
    release();
    await first;
    expect(operation).not.toHaveBeenCalled();
    await expect(queue.run(async () => 'next')).resolves.toBe('next');
  });
});
