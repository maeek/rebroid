import { Injectable } from '@nestjs/common';

@Injectable()
export class AndroidAppsProvisioningTrackerService {
  private readonly cancelledProvisioning = new Set<string>();

  /** Clears the cancel flag for one app. */
  reset(applicationId: string) {
    this.cancelledProvisioning.delete(applicationId);
  }

  /** Marks one app provisioning run as cancelled. */
  cancel(applicationId: string) {
    this.cancelledProvisioning.add(applicationId);
  }

  /** Stops work if this app was cancelled. */
  ensureActive(applicationId: string) {
    if (this.cancelledProvisioning.has(applicationId)) {
      throw new Error(`Provisioning cancelled for ${applicationId}`);
    }
  }

  /** Checks if an error means provisioning was cancelled. */
  isCancellationError(error: unknown) {
    return (
      error instanceof Error &&
      error.message.startsWith('Provisioning cancelled for ')
    );
  }
}
