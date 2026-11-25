import { ConflictException } from '@nestjs/common';
import { In, IsNull, type EntityManager } from 'typeorm';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';

export async function assertOpenDeviceSlot(
  manager: EntityManager,
  ownerUserId: string | null,
  limit?: number,
) {
  if (limit === undefined) return;
  const owner = ownerUserId ?? IsNull();
  const managed = await manager.getRepository(AndroidApplication).countBy([
    {
      ownerUserId: owner,
      status: In([
        AndroidApplicationStatus.Running,
        AndroidApplicationStatus.Provisioning,
      ]),
    },
    {
      ownerUserId: owner,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopping,
    },
  ]);
  const [external] = (await manager.query(
    'SELECT COUNT(*) AS count FROM external_android_devices WHERE ownerUserId = ? AND attemptId IS NOT NULL',
    [ownerUserId],
  )) as Array<{ count: number }>;
  const open = managed + external.count;
  if (open >= limit) {
    throw new ConflictException({
      statusCode: 409,
      code: 'open_app_quota_exceeded',
      message: `Open device limit reached (${open}/${limit}). Disconnect or stop a device before opening another.`,
    });
  }
}
