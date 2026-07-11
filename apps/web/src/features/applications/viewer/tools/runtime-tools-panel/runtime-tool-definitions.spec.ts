import { describe, expect, it } from 'vitest'
import { defaultViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import { getRuntimeTools, runtimeToolPanelClassName } from './runtime-tool-definitions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { PermissionMap } from '@/shared/permissions/permissions'

const app = {
  id: 'app_1',
  name: 'Demo',
  icon: null,
  running: true,
  status: 'running',
  lifecycleStage: 'ready',
  statusMessage: null,
  statusDetail: null,
  ownerUserId: 'user_1',
  containerImage: 'redroid:13',
  containerName: 'rebroid-app-1',
  containerId: 'container_1',
  networkName: 'rebroid',
  volumeName: 'rebroid-app-1',
  profileName: null,
  memoryLimitMb: null,
  cpuLimitCpus: null,
  containerArgs: null,
  recreateContainerOnNextStart: false,
  networkPolicyEnabled: false,
  networkPolicyAllowCidrs: [],
  networkPolicyStatus: null,
  networkPolicyMessage: null,
  networkPolicyResult: null,
  networkPolicyAppliedAt: null,
  apkOriginalName: null,
  apkPackageName: null,
  apkFilePath: null,
  uploadedApkId: null,
  scrcpyTransport: 'webrtc',
  adbPort: 5555,
  inactivityTimeoutSeconds: 300,
  lastError: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  imagePullProgress: null,
  applicationError: null,
  apk: { version: '' },
  profileMode: 'temporary',
  savedProfiles: []
} satisfies AppDefinition

const allPermissions: PermissionMap = {
  'applications:configure-egress': true,
  'applications:sync-clipboard': true,
  'applications:transfer-files': true,
  'applications:view-logs': true,
  'automations:run': true,
  'automations:run-ai': true
}

describe('getRuntimeTools', () => {
  it('keeps the mobile cap but lets desktop chat reach the viewport bottom', () => {
    const className = runtimeToolPanelClassName('ai-agent')

    expect(className).toContain('max-h-[36rem]')
    expect(className).toContain('md:max-h-none')
    expect(className).toContain('lg:h-[calc(100dvh-16rem)]')
    expect(className).not.toContain('lg:max-h-[52rem]')
  })

  it('shows every running-runtime tool when permissions allow it', () => {
    const tools = getRuntimeTools({
      app,
      latestAutomationRun: { id: 'run_1234567890' } as never,
      permissions: allPermissions,
      viewerSettings: defaultViewerSettings
    })

    expect(tools.map(tool => tool.id)).toEqual([
      'ai-agent',
      'workflows',
      'clipboard',
      'streaming',
      'network-access',
      'files',
      'logs'
    ])
    expect(tools.find(tool => tool.id === 'workflows')?.description).toBe('Run run_1234')
  })

  it('keeps the AI workspace visible while hiding device-only tools when stopped', () => {
    const tools = getRuntimeTools({
      app: { ...app, running: false, status: 'stopped' },
      latestAutomationRun: null,
      permissions: allPermissions,
      viewerSettings: defaultViewerSettings
    })

    expect(tools.map(tool => tool.id)).toEqual(['ai-agent', 'workflows', 'streaming', 'network-access'])
    expect(tools.find(tool => tool.id === 'ai-agent')?.description).toContain('remain available')
  })
})
