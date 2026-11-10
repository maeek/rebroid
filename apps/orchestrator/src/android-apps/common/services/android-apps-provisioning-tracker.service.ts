import { Injectable } from '@nestjs/common';

@Injectable()
export class AndroidAppsProvisioningTrackerService {
  private readonly imageWaits = new Map<string, AbortController>();
  private readonly cancelledProvisioning = new Set<string>();

  /** Clears the cancel flag for one app. */
  reset(applicationId: string) {
    this.cancelledProvisioning.delete(applicationId);
  }

  /** Marks one app provisioning run as cancelled. */
  cancel(applicationId: string) {
    this.cancelledProvisioning.add(applicationId);
    this.imageWaits
      .get(applicationId)
      ?.abort(new Error(`Provisioning cancelled for ${applicationId}`));
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
