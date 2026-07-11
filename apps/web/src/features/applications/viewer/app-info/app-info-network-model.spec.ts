import { describe, expect, it } from 'vitest'
import {
  adbAddressForApp,
  getAppAllowCidrs,
  getAppId,
  getPolicyHint,
  getPolicyMessage,
  getPolicyStatusDescription,
  getPolicyStatusText,
  isNetworkAccessDisabled
} from './app-info-network-model'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const app = (override: Partial<AppDefinition> = {}): AppDefinition => ({
  id: 'app-1',
  name: 'Demo',
  icon: null,
  running: true,
  status: 'running',
  lifecycleStage: 'ready',
  statusMessage: null,
  statusDetail: null,
  ownerUserId: null,
  containerImage: 'redroid',
  containerName: 'container-1',
  containerId: null,
  networkName: 'network',
  volumeName: 'volume',
  profileName: null,
  memoryLimitMb: null,
  cpuLimitCpus: null,
  containerArgs: null,
  recreateContainerOnNextStart: false,
  networkPolicyEnabled: true,
  networkPolicyAllowCidrs: ['10.0.0.0/8'],
  networkPolicyStatus: 'legacy-status',
  networkPolicyMessage: 'legacy message',
  networkPolicyResult: null,
  networkPolicyAppliedAt: null,
  apkOriginalName: null,
  apkPackageName: null,
  apkFilePath: null,
  uploadedApkId: null,
  scrcpyTransport: 'webrtc',
  adbPort: 5555,
  inactivityTimeoutSeconds: 900,
  lastError: null,
  createdAt: new Date('2020-01-01T00:00:00.000Z'),
  updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  imagePullProgress: null,
  applicationError: null,
  apk: { version: '' },
  profileMode: 'persistent',
  savedProfiles: [],
  ...override
})

describe('app info network model', () => {
  it('falls back to legacy policy status and message fields when no result exists', () => {
    const value = app()

    expect(getPolicyStatusText(value)).toBe('legacy-status')
    expect(getPolicyMessage(value)).toBe('legacy message')
    expect(getPolicyHint(value)).toBeUndefined()
  })

  it('prefers structured network policy result details', () => {
    const value = app({
      networkPolicyResult: {
        status: 'error',
        code: 'apply_failed',
        message: 'iptables failed',
        hint: 'Check firewall agent'
      }
    })

    expect(getPolicyStatusText(value)).toBe('error')
    expect(getPolicyMessage(value)).toBe('iptables failed')
    expect(getPolicyHint(value)).toBe('Check firewall agent')
    expect(getPolicyStatusDescription(value.networkPolicyResult)).toBe('Check firewall agent')
  })

  it('describes missing and unknown policy results', () => {
    expect(getPolicyStatusDescription(null)).toBe('The network policy has not been applied yet.')
    expect(
      getPolicyStatusDescription({
        status: 'error',
        code: 'unknown',
        message: 'Unexpected status',
        hint: null
      })
    ).toBe('Unexpected status')
  })

  it('derives app id, allowlist, disabled state, and adb address', () => {
    const value = app()

    expect(getAppId(value)).toBe('app-1')
    expect(getAppAllowCidrs(value)).toEqual(['10.0.0.0/8'])
    expect(getAppAllowCidrs()).toEqual([])
    expect(isNetworkAccessDisabled()).toBe(true)
    expect(isNetworkAccessDisabled(value)).toBe(false)
    expect(adbAddressForApp(value)).toBe('container-1:5555')
  })
})
