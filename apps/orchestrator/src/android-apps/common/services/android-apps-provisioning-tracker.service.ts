import { Injectable } from '@nestjs/common';

@Injectable()
export class AndroidAppsProvisioningTrackerService {
  private readonly imageWaits = new Map<string, AbortController>();
  private readonly cancelledProvisioning = new Set<string>();
  private readonly runtimeWork = new Map<string, Set<AbortController>>();

  /** Clears the cancel flag for one app. */
  reset(applicationId: string) {
    this.cancelledProvisioning.delete(applicationId);
  }

  /** Marks one app provisioning run as cancelled. */
  cancel(applicationId: string) {
    this.cancelledProvisioning.add(applicationId);
    const reason = new Error(`Provisioning cancelled for ${applicationId}`);
    for (const controller of this.runtimeWork.get(applicationId) ?? []) {
      controller.abort(reason);
    }
    this.imageWaits.get(applicationId)?.abort(reason);
  }

  /** Withdraw queued work on cancellation, but let its owner drain admitted work. */
  async withCancellation<T>(
    applicationId: string,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    this.ensureActive(applicationId);
    const controller = new AbortController();
    const active =
      this.runtimeWork.get(applicationId) ?? new Set<AbortController>();
    this.runtimeWork.set(applicationId, active);
    active.add(controller);
    try {
      const result = await operation(controller.signal);
      controller.signal.throwIfAborted();
      return result;
    } finally {
      active.delete(controller);
      if (active.size === 0) this.runtimeWork.delete(applicationId);
    }
  }

  async waitForImage(
    applicationId: string,
    pull: (signal: AbortSignal) => Promise<void>,
  ) {
    this.ensureActive(applicationId);
    const controller = new AbortController();
    this.imageWaits.set(applicationId, controller);
    const { signal } = controller;
    try {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        void pull(signal)
          .then(resolve, reject)
          .finally(() => {
            signal.removeEventListener('abort', onAbort);
          });
      });
    } finally {
      this.imageWaits.delete(applicationId);
    }
  }

  isCancelled(applicationId: string) {
    return this.cancelledProvisioning.has(applicationId);
  }

  /** Stops work if this app was cancelled. */
  ensureActive(applicationId: string) {
    if (this.isCancelled(applicationId)) {
      throw new Error(`Provisioning cancelled for ${applicationId}`);
    }
  }
}
