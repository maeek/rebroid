import type { AndroidApplication } from '@/shared/contracts/application'

export const applicationPreview: AndroidApplication = {
  id: 'preview-app',
  name: 'Inventory worker',
  ownerUserId: 'preview-owner',
  status: {
    currentStatus: 'stopped',
    lifecycleStage: 'stopped',
    message: null,
    detail: null,
    progress: null,
    recreateRequired: false,
    lastScrcpyActivityAt: null,
    lastStartedAt: null,
    lastStoppedAt: null,
    provisioningStartedAt: null,
    provisioningCompletedAt: null
  },
  errors: { lastError: null, application: null },
  runtime: {
    image: 'redroid/redroid:14.0.0-latest',
    kind: 'redroid',
    containerName: 'inventory-worker',
    containerId: null,
    containerArgs: null,
    adbPort: 5555,
    scrcpyTransport: 'webrtc',
    inactivityTimeoutSeconds: 900,
    resources: { memoryLimitMb: null, cpuLimitCpus: null }
  },
  storage: {
    volumeName: 'inventory-data',
    profileMode: 'persistent',
    profileName: 'default',
    savedProfiles: [
      { mode: 'persistent', name: 'default' },
      { mode: 'persistent', name: 'qa' }
    ]
  },
  network: {
    networkName: 'inventory-network',
    policy: { enabled: true, allowCidrs: ['10.0.0.0/24'], status: null, message: null, result: null, appliedAt: null }
  },
  apk: { filePath: null, originalName: null, packageName: null, uploadedApkId: null },
  createdAt: '2026-11-07T10:00:00Z',
  updatedAt: '2026-11-07T10:00:00Z'
}
