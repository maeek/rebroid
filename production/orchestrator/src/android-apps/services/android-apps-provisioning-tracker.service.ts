import { Injectable } from '@nestjs/common';

@Injectable()
export class AndroidAppsProvisioningTrackerService {
  private readonly cancelledProvisioning = new Set<string>();

  reset(applicationId: string) {
    this.cancelledProvisioning.delete(applicationId);
  }

  cancel(applicationId: string) {
    this.cancelledProvisioning.add(applicationId);
  }

  ensureActive(applicationId: string) {
    if (this.cancelledProvisioning.has(applicationId)) {
      throw new Error(`Provisioning cancelled for ${applicationId}`);
    }
  }

  isCancellationError(error: unknown) {
    return (
      error instanceof Error &&
      error.message.startsWith('Provisioning cancelled for ')
    );
  }
}