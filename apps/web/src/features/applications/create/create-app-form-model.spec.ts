import { describe, expect, it } from '@jest/globals'
import {
  appNameFromApk,
  buildCreateApplicationInput,
  getCustomDisplayConfig,
  getInitialCreateAppFormValues,
  isCreateAppSubmitDisabled
} from './create-app-form-model'
import type { CreateAppFormValues } from './create-app-form.types'
import type { UploadedApk } from '@/server/orchestrator/applications/types'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

const settings = {
  defaultContainerImage: 'redroid/redroid:13.0.0',
  defaultInactivityTimeoutSeconds: 120,
  maxApkUploadSizeMb: 256
} as unknown as OrchestratorUiSettings

const values = (overrides: Partial<CreateAppFormValues> = {}): CreateAppFormValues => ({
  ...getInitialCreateAppFormValues(settings),
  ...overrides
})

describe('create app form model', () => {
  it('builds initial values from UI settings', () => {
    expect(getInitialCreateAppFormValues(settings)).toMatchObject({
      containerImage: 'redroid/redroid:13.0.0',
      inactivityTimeoutSeconds: 120,
      networkPolicyEnabled: true
    })
  })

  it('infers application names from APK metadata or filenames', () => {
    expect(appNameFromApk('ignored.apk', { displayName: '  Calendar  ' })).toBe('Calendar')
    expect(appNameFromApk('my_app-release.apk')).toBe('my app release')
  })

  it('parses only complete positive integer custom display values', () => {
    expect(
      getCustomDisplayConfig(
        values({
          redroidCustomDisplayWidth: '1080',
          redroidCustomDisplayHeight: '2340',
          redroidCustomDisplayDpi: '440'
        })
      )
    ).toEqual({ width: 1080, height: 2340, dpi: 440 })
    expect(getCustomDisplayConfig(values({ redroidCustomDisplayWidth: '0' }))).toBeNull()
    expect(getCustomDisplayConfig(values({ redroidCustomDisplayDpi: '440.5' }))).toBeNull()
  })

  it('disables submit for busy, short-name, and invalid custom display states', () => {
    const base = values({ name: 'App', redroidDisplayProfileId: 'custom' })

    expect(
      isCreateAppSubmitDisabled({
        canChangeContainerArgs: true,
        customDisplayConfig: null,
        isCreating: false,
        isRedroidRuntime: true,
        isUploadingApk: false,
        trimmedName: 'App',
        values: base
      })
    ).toBe(true)
    expect(
      isCreateAppSubmitDisabled({
        canChangeContainerArgs: true,
        customDisplayConfig: getCustomDisplayConfig(base),
        isCreating: false,
        isRedroidRuntime: true,
        isUploadingApk: false,
        trimmedName: 'A',
        values: base
      })
    ).toBe(true)
  })

  it('builds create input according to permission gates', () => {
    const input = buildCreateApplicationInput({
      canChangeBaseImage: true,
      canChangeContainerArgs: true,
      canChangeResources: true,
      canChangeSessionLimit: true,
      canConfigureEgress: true,
      canUseInternet: false,
      customDisplayConfig: undefined,
      isRedroidRuntime: false,
      trimmedName: 'App',
      uploadedApk: { id: 'apk-1' } as UploadedApk,
      values: values({
        containerImage: ' custom/image ',
        customContainerArgs: ' --foo bar ',
        cpuLimitCpus: '2',
        memoryLimitMb: '512',
        networkPolicyEnabled: false,
        networkPolicyAllowCidrs: ['0.0.0.0/0']
      })
    })

    expect(input).toMatchObject({
      name: 'App',
      containerImage: 'custom/image',
      containerArgs: '--foo bar',
      cpuLimitCpus: 2,
      memoryLimitMb: 512,
      networkPolicyEnabled: true,
      networkPolicyAllowCidrs: ['0.0.0.0/0'],
      uploadedApkId: 'apk-1'
    })
  })

  it('omits gated fields when permissions are missing', () => {
    const input = buildCreateApplicationInput({
      canChangeBaseImage: false,
      canChangeContainerArgs: false,
      canChangeResources: false,
      canChangeSessionLimit: false,
      canConfigureEgress: false,
      canUseInternet: false,
      customDisplayConfig: undefined,
      isRedroidRuntime: false,
      trimmedName: 'App',
      uploadedApk: null,
      values: values({
        containerImage: 'custom/image',
        customContainerArgs: '--foo',
        cpuLimitCpus: '2',
        memoryLimitMb: '512'
      })
    })

    expect(input).toEqual({ name: 'App', uploadedApkId: undefined })
  })
})
