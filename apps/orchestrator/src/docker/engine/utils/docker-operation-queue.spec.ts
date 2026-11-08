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
});
