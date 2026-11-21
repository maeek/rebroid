import { ConflictException } from '@nestjs/common';
import type { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';

export type RunningAndroidApplication = AndroidApplication & {
  containerId: string;
};

export function assertRunningApplication(
  app: AndroidApplication,
): asserts app is RunningAndroidApplication {
  if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
    throw new ConflictException(
      'Application must be running before using viewer runtime tools.',
    );
  }
}
