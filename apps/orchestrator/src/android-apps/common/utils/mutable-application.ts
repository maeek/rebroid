import { ConflictException } from '@nestjs/common';
import type { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';

export function assertMutableApplication(
  app: Pick<AndroidApplication, 'status'>,
) {
  if (app.status === AndroidApplicationStatus.Removing) {
    throw new ConflictException('Cannot update an application being removed.');
  }
  if (app.status === AndroidApplicationStatus.Removed) {
    throw new ConflictException('Removed applications cannot be updated.');
  }
}
