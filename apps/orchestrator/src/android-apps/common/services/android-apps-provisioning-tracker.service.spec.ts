import { AndroidAppsProvisioningTrackerService } from './android-apps-provisioning-tracker.service';

describe('Provisioning cancellation scopes', () => {
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
