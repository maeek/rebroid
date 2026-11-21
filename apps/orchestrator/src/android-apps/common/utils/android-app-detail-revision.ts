import { createHash } from 'node:crypto';
import type { AndroidApplication } from '../../android-application.entity';

// These fields are delivered by the lifecycle projection or excluded from app detail.
const dynamicFields = new Set<keyof AndroidApplication>([
  'status',
  'lifecycleStage',
  'statusMessage',
  'statusDetail',
  'lastError',
  'applicationError',
  'imagePullProgress',
  'lastStartedAt',
  'lastStoppedAt',
  'provisioningStartedAt',
  'provisioningCompletedAt',
  'recreateContainerOnNextStart',
  'removeDataOnRemoval',
  'networkPolicyResult',
  'updatedAt',
  'lastScrcpyActivityAt',
]);

export const androidAppDetailRevision = (app: AndroidApplication) => {
  const configuration = Object.entries(app).filter(
    ([key]) => !dynamicFields.has(key as keyof AndroidApplication),
  );
  return createHash('sha256')
    .update(JSON.stringify(configuration))
    .digest('hex');
};
