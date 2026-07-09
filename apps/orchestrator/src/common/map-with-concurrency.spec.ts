import {
  mapSettledWithConcurrency,
  mapWithConcurrency,
} from './map-with-concurrency';

describe('mapWithConcurrency', () => {
  it('never starts more than the configured number of tasks', async () => {
    const flushTasks = () =>
      new Promise<void>((resolve) => setImmediate(resolve));
    let active = 0;
    let maximumActive = 0;
    const releases: Array<() => void> = [];
    const result = mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return value * 2;
    });

    await flushTasks();
    expect(releases).toHaveLength(2);
    releases.splice(0).forEach((release) => release());
    await flushTasks();
    expect(releases).toHaveLength(2);
    releases.splice(0).forEach((release) => release());
    await flushTasks();
    expect(releases).toHaveLength(1);
    releases.splice(0).forEach((release) => release());

    await expect(result).resolves.toEqual([2, 4, 6, 8, 10]);
    expect(maximumActive).toBe(2);
  });

  it('collects mapper failures without rejecting the batch', async () => {
    await expect(
      mapSettledWithConcurrency([1, 2], 1, async (value) => {
        if (value === 2) throw new Error('failed');
        return value * 2;
      }),
    ).resolves.toEqual([
      { status: 'fulfilled', value: 2 },
      { status: 'rejected', reason: new Error('failed') },
    ]);
  });
});
