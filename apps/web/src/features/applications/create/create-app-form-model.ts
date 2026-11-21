import {
  applyRedroidDisplayContainerArgs,
  defaultRedroidDisplayProfileId,
  type RuntimeImageKind
} from '@rebroid/android-application-core/redroid-runtime'
import { readRuntimeNumber } from '../model/app-runtime-settings'
import type { CreateAppFormValues } from './create-app-form.types'
import type { CreateApplicationActionInput, UploadedApk } from '@/shared/contracts/application'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const getInitialCreateAppFormValues = (settings: OrchestratorUiSettings): CreateAppFormValues => ({
  name: '',
  containerImage: settings.defaultContainerImage,
  inactivityTimeoutSeconds: String(settings.defaultInactivityTimeoutSeconds),
  memoryLimitMb: '',
  cpuLimitCpus: '',
  customContainerArgs: '',
  redroidDisplayProfileId: defaultRedroidDisplayProfileId,
  redroidCustomDisplayWidth: '1080',
  redroidCustomDisplayHeight: '2340',
  redroidCustomDisplayDpi: '440',
  redroidExtraArgs: '',
  networkPolicyEnabled: true,
  networkPolicyAllowCidrs: []
})

export const appNameFromApk = (fileName: string, uploaded?: Pick<UploadedApk, 'displayName'> | null) =>
  uploaded?.displayName?.trim() ||
  fileName
    .replace(/\.apk$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const parseCustomDisplayValue = (value: string) => {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export const getCustomDisplayConfig = (values: CreateAppFormValues) => {
  const width = parseCustomDisplayValue(values.redroidCustomDisplayWidth)
  const height = parseCustomDisplayValue(values.redroidCustomDisplayHeight)
  const dpi = parseCustomDisplayValue(values.redroidCustomDisplayDpi)

  return width && height && dpi ? { width, height, dpi } : null
}

export const customDisplayFields = [
  ['Width', 'redroidCustomDisplayWidth'],
  ['Height', 'redroidCustomDisplayHeight'],
  ['DPI', 'redroidCustomDisplayDpi']
] as const

export const validateCreateAppDraft = (values: CreateAppFormValues, usesRedroidDisplay: boolean) => {
  const errors: Record<string, string[]> = {}
  if (values.name.trim().length < 2) errors.name = ['Enter a name with at least 2 characters.']
  if (usesRedroidDisplay && values.redroidDisplayProfileId === 'custom') {
    for (const [, field] of customDisplayFields) {
      if (parseCustomDisplayValue(values[field]) === null) {
        errors[field] = ['Enter a whole number greater than zero.']
      }
    }
  }
  return errors
}

export const buildCreateApplicationInput = ({
  canChangeBaseImage,
  canChangeContainerArgs,
  canChangeResources,
  canChangeSessionLimit,
  canConfigureEgress,
  canUseInternet,
  customDisplayConfig,
  isRedroidRuntime,
  runtimeKind,
  trimmedName,
  uploadedApk,
  values
}: {
  canChangeBaseImage: boolean
  canChangeContainerArgs: boolean
  canChangeResources: boolean
  canChangeSessionLimit: boolean
  canConfigureEgress: boolean
  canUseInternet: boolean
  customDisplayConfig: ReturnType<typeof getCustomDisplayConfig> | undefined
  isRedroidRuntime: boolean
  runtimeKind?: RuntimeImageKind
  trimmedName: string
  uploadedApk: UploadedApk | null
  values: CreateAppFormValues
}): CreateApplicationActionInput => ({
  name: trimmedName,
  containerImage: canChangeBaseImage ? values.containerImage.trim() || undefined : undefined,
  inactivityTimeoutSeconds: canChangeSessionLimit
    ? (readRuntimeNumber(values.inactivityTimeoutSeconds) ?? undefined)
    : undefined,
  memoryLimitMb: canChangeResources ? (readRuntimeNumber(values.memoryLimitMb) ?? undefined) : undefined,
  cpuLimitCpus: canChangeResources ? (readRuntimeNumber(values.cpuLimitCpus) ?? undefined) : undefined,
  containerArgs: canChangeContainerArgs
    ? (isRedroidRuntime
        ? applyRedroidDisplayContainerArgs(
            values.containerImage,
            values.redroidDisplayProfileId,
            values.redroidExtraArgs,
            customDisplayConfig ?? undefined,
            runtimeKind
          )
        : values.customContainerArgs.trim()) || undefined
    : undefined,
  uploadedApkId: uploadedApk?.id,
  ...(canConfigureEgress
    ? {
        networkPolicyEnabled: canUseInternet ? values.networkPolicyEnabled : true,
        networkPolicyAllowCidrs: values.networkPolicyAllowCidrs
      }
    : {})
})
