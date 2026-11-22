import { AndroidAppsProvisioningTrackerService } from './android-apps-provisioning-tracker.service';

describe('Provisioning cancellation scopes', () => {
  it('keeps every pending image waiter cancellable after an older pull completes', async () => {
    const tracker = new AndroidAppsProvisioningTrackerService();
    let complete!: () => void;
    const first = tracker.waitForImage(
      'app',
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const signals: AbortSignal[] = [];
    const wait = (signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<void>(() => {});
    };
    const pending = Promise.allSettled([
      tracker.waitForImage('app', wait),
      tracker.waitForImage('app', wait),
    ]);
    const other = tracker.waitForImage('other', wait);
    complete();
    await first;
    tracker.cancel('app');
    expect(signals.map((signal) => signal.aborted)).toEqual([
      true,
      true,
      false,
    ]);
    expect(await pending).toEqual([
      { status: 'rejected', reason: signals[0].reason },
      { status: 'rejected', reason: signals[1].reason },
    ]);
    tracker.cancel('other');
    await expect(other).rejects.toThrow('cancelled for other');
  });

  it('cancels parallel branches but retains admitted work until it drains', async () => {
    const tracker = new AndroidAppsProvisioningTrackerService();
    let release!: () => void;
    let admittedSignal!: AbortSignal;
    const admitted = tracker.withCancellation('app', async (signal) => {
      admittedSignal = signal;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const queued = tracker.withCancellation(
      'app',
      (signal) =>
        new Promise<void>((_, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    let drained = false;
    const failedAdmission = expect(admitted).rejects.toThrow('cancelled');
    const failedQueue = expect(queued).rejects.toThrow('cancelled');
    void admitted.catch(() => {
      drained = true;
    });
    tracker.cancel('app');
    await failedQueue;
    expect(admittedSignal.aborted).toBe(true);
    expect(drained).toBe(false);
    release();
    await failedAdmission;
    tracker.reset('app');
    await expect(
      tracker.withCancellation('app', async (signal) => signal.aborted),
    ).resolves.toBe(false);
  });

  it('releases completed scopes and rejects work admitted after cancellation', async () => {
    const tracker = new AndroidAppsProvisioningTrackerService();
    const finished = await tracker.withCancellation(
      'app',
      async (signal) => signal,
    );
    tracker.cancel('app');
    expect(finished.aborted).toBe(false);
    const operation = jest.fn();
    await expect(tracker.withCancellation('app', operation)).rejects.toThrow(
      'cancelled',
    );
    expect(operation).not.toHaveBeenCalled();
  });
});
