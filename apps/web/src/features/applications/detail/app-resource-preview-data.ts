import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { FeatureFlagKey, FeatureFlagManifest, FeatureFlagState } from '@/shared/contracts/feature-flags'

const enabledPreviewFeature = (key: FeatureFlagKey, owner: FeatureFlagState['owner']): FeatureFlagState => ({
  key,
  owner,
  description: '',
  revision: 1,
  control: 'runtime',
  mutable: true,
  enabled: true,
  supported: true,
  effective: true,
  syncStatus: 'applied',
  disablePolicy: 'block_new',
  lifecycle: 'permanent',
  removalCondition: null,
  dependencies: [],
  conflicts: []
})

export const appResourcePreviewFeatures: FeatureFlagManifest = {
  revision: 1,
  features: [
    enabledPreviewFeature('feature.ai', 'automations'),
    enabledPreviewFeature('feature.workflows', 'automations'),
    enabledPreviewFeature('feature.display-webrtc', 'display')
  ]
}

export const previewApp: AppDefinition = {
  id: 'preview-app',
  name: 'Inventory worker',
  icon: null,
  running: false,
  status: 'error',
  lifecycleStage: 'error',
  statusMessage: 'Android did not finish starting.',
  statusDetail: null,
  ownerUserId: 'preview-owner',
  containerImage: 'redroid/redroid:14.0.0-latest',
  runtimeKind: 'redroid',
  containerName: 'inventory-worker',
  containerId: null,
  networkName: 'apps',
  volumeName: 'inventory-data',
  profileName: 'default',
  profileMode: 'persistent',
  memoryLimitMb: 2048,
  cpuLimitCpus: 2,
  containerArgs: null,
  recreateContainerOnNextStart: true,
  networkPolicyEnabled: true,
  networkPolicyAllowCidrs: [],
  networkPolicyResult: null,
  networkPolicyAppliedAt: null,
  apkOriginalName: 'inventory.apk',
  apkPackageName: 'com.example.inventory',
  apkFilePath: null,
  uploadedApkId: null,
  scrcpyTransport: 'websocket',
  adbPort: 5555,
  inactivityTimeoutSeconds: 900,
  lastError: 'Android boot timed out.',
  createdAt: new Date('2026-11-07T10:00:00Z'),
  updatedAt: new Date('2026-11-07T10:05:00Z'),
  imagePullProgress: null,
  applicationError: null,
  apk: { version: '1.0' },
  savedProfiles: []
}
