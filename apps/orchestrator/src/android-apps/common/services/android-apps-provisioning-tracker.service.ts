import { Injectable } from '@nestjs/common';
import { waitForOperation } from '../../../common/wait-for-operation';

@Injectable()
export class AndroidAppsProvisioningTrackerService {
  private readonly cancelledProvisioning = new Set<string>();
  private readonly runtimeWork = new Map<string, Set<AbortController>>();

  reset(applicationId: string) {
    this.cancelledProvisioning.delete(applicationId);
  }

  cancel(applicationId: string) {
    this.cancelledProvisioning.add(applicationId);
    const reason = new Error(`Provisioning cancelled for ${applicationId}`);
    for (const controller of this.runtimeWork.get(applicationId) ?? []) {
      controller.abort(reason);
    }
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

  waitForImage(
    applicationId: string,
    pull: (signal: AbortSignal) => Promise<void>,
  ) {
    return this.withCancellation(applicationId, (signal) =>
      waitForOperation(pull(signal), signal),
    );
  }

  isCancelled(applicationId: string) {
    return this.cancelledProvisioning.has(applicationId);
  }

  ensureActive(applicationId: string) {
    if (this.isCancelled(applicationId)) {
      throw new Error(`Provisioning cancelled for ${applicationId}`);
    }
  }
}
