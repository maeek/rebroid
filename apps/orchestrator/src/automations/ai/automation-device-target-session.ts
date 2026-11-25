import { createHash } from 'node:crypto';
import type {
  ExternalAutomationApplication,
  ManagedAutomationApplication,
} from '../../android-apps/contracts/android-apps-automation.port';

type TargetApplication =
  | Pick<
      ManagedAutomationApplication,
      | 'id'
      | 'containerId'
      | 'containerName'
      | 'networkName'
      | 'adbPort'
      | 'lastStartedAt'
      | 'kind'
    >
  | ExternalAutomationApplication;

export interface DeviceTargetSession {
  id: string;
  fingerprint: string;
}

export const createTargetSession = (
  app: TargetApplication,
): DeviceTargetSession => {
  const identity =
    app.kind === 'external'
      ? ['external', app.id, app.attachmentId ?? 'offline'].join('|')
      : [
          app.id,
          app.containerId ?? 'no-container',
          app.containerName,
          app.networkName,
          app.adbPort,
          app.lastStartedAt?.getTime() ?? 'no-start',
        ].join('|');
  const fingerprint = createHash('sha256')
    .update(identity)
    .digest('hex')
    .slice(0, 16);
  return {
    id: `target-${fingerprint}`,
    fingerprint,
  };
};

export const assertTargetSession = (
  expected: DeviceTargetSession,
  app: TargetApplication,
) => {
  const current = createTargetSession(app);
  if (current.fingerprint !== expected.fingerprint) {
    throw new Error(
      `Automation target changed from ${expected.fingerprint} to ${current.fingerprint}; a fresh observation is required.`,
    );
  }
};
