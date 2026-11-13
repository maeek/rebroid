import { AndroidBootOperationTimer } from './android-boot-operation-timer';

describe('Android boot operation timing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('records rejected queue admission without claiming any Docker execution', async () => {
    let now = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    const timer = new AndroidBootOperationTimer(0);
    const failure = new Error('expired in queue');
    await expect(
      timer.run(async () => {
        now = 600;
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(timer.snapshot()).toEqual({
      outcome: 'rejected',
      dispatched: false,
      queuedAfterMs: 100,
      dispatchedAfterMs: null,
      settledAfterMs: 600,
      queueMs: 500,
      executionMs: null,
      totalMs: 500,
    });
  });

  it('retains the first admission and includes failed work through cleanup', async () => {
    let now = 100;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    const timer = new AndroidBootOperationTimer(0);
    const failure = new Error('Docker transport failed');
    await expect(
      timer.run(async (onDispatched) => {
        now = 300;
        onDispatched();
        now = 400;
        onDispatched();
        now = 800;
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(timer.snapshot()).toEqual({
      outcome: 'rejected',
      dispatched: true,
      queuedAfterMs: 100,
      dispatchedAfterMs: 300,
      settledAfterMs: 800,
      queueMs: 200,
      executionMs: 500,
      totalMs: 700,
    });
  });
});
