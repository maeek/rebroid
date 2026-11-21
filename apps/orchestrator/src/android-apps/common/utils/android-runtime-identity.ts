import { createHash } from 'node:crypto';
import type { AndroidApplication } from '../../android-application.entity';

type RuntimeIdentity = Pick<
  AndroidApplication,
  | 'id'
  | 'ownerUserId'
  | 'containerId'
  | 'lastStartedAt'
  | 'profileMode'
  | 'profileName'
  | 'containerName'
  | 'networkName'
  | 'adbPort'
>;

// Snapshot records persist a hash of this field order and raw profile name.
export const runtimeIdentityKey = (
  app: RuntimeIdentity,
  profileName = app.profileName,
) =>
  JSON.stringify([
    app.id,
    app.ownerUserId,
    app.containerId,
    app.lastStartedAt,
    app.profileMode,
    profileName,
    app.containerName,
    app.networkName,
    app.adbPort,
  ]);

export const snapshotRuntimeKey = (app: RuntimeIdentity) =>
  createHash('sha256').update(runtimeIdentityKey(app)).digest('hex');

export const viewerActivityRuntimeKey = (
  app: Pick<
    RuntimeIdentity,
    'id' | 'ownerUserId' | 'containerId' | 'lastStartedAt'
  >,
) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        app.id,
        app.ownerUserId,
        app.containerId,
        app.lastStartedAt,
      ]),
    )
    .digest('hex');
