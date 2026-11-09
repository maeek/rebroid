import {
  applyRedroidDisplayContainerArgs,
  defaultRedroidDisplayProfileId,
  type RuntimeImageKind
} from '@rebroid/android-application-core/redroid-runtime'
import type { CreateAppFormValues } from './create-app-form.types'
import type { CreateApplicationActionInput, UploadedApk } from '@/shared/contracts/application'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

export const getInitialCreateAppFormValues = (settings: OrchestratorUiSettings): CreateAppFormValues => ({
  name: '',
  containerImage: settings.defaultContainerImage,
  inactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
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

export const validateCreateAppNumericFields = (form: HTMLFormElement) => {
  const errors: Record<string, string[]> = {}

  for (const field of ['memoryLimitMb', 'cpuLimitCpus', 'inactivityTimeoutSeconds']) {
    const input = form.elements.namedItem(field)
    if (!(input instanceof HTMLInputElement) || !input.willValidate || input.validity.valid) continue

    if (input.validity.rangeOverflow) errors[field] = [`Enter a value of ${input.max} or less.`]
    else if (input.validity.rangeUnderflow) errors[field] = [`Enter a value of ${input.min} or more.`]
    else if (input.validity.stepMismatch) errors[field] = [`Enter a value in increments of ${input.step || '1'}.`]
    else errors[field] = [input.validationMessage]
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
  inactivityTimeoutSeconds: canChangeSessionLimit ? values.inactivityTimeoutSeconds : undefined,
  memoryLimitMb: canChangeResources && values.memoryLimitMb ? Number(values.memoryLimitMb) : undefined,
  cpuLimitCpus: canChangeResources && values.cpuLimitCpus ? Number(values.cpuLimitCpus) : undefined,
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
