import {
  applyRedroidDisplayContainerArgs,
  defaultRedroidDisplayProfileId
} from '@rebroid/application-core/redroid-runtime'
import type { CreateAppFormValues } from './create-app-form.types'
import type { CreateApplicationActionInput, UploadedApk } from '@/server/orchestrator/applications/types'
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

export const isCreateAppSubmitDisabled = ({
  canChangeContainerArgs,
  customDisplayConfig,
  isCreating,
  isRedroidRuntime,
  isUploadingApk,
  trimmedName,
  values
}: {
  canChangeContainerArgs: boolean
  customDisplayConfig: ReturnType<typeof getCustomDisplayConfig> | undefined
  isCreating: boolean
  isRedroidRuntime: boolean
  isUploadingApk: boolean
  trimmedName: string
  values: CreateAppFormValues
}) =>
  isCreating ||
  isUploadingApk ||
  trimmedName.length < 2 ||
  (isRedroidRuntime && canChangeContainerArgs && values.redroidDisplayProfileId === 'custom' && !customDisplayConfig)

export const buildCreateApplicationInput = ({
  canChangeBaseImage,
  canChangeContainerArgs,
  canChangeResources,
  canChangeSessionLimit,
  canConfigureEgress,
  canUseInternet,
  customDisplayConfig,
  isRedroidRuntime,
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
  trimmedName: string
  uploadedApk: UploadedApk | null
  values: CreateAppFormValues
}): CreateApplicationActionInput => ({
  name: trimmedName,
  containerImage: canChangeBaseImage ? values.containerImage.trim() || undefined : undefined,
  inactivityTimeoutSeconds: canChangeSessionLimit ? values.inactivityTimeoutSeconds || undefined : undefined,
  memoryLimitMb: canChangeResources && values.memoryLimitMb ? Number(values.memoryLimitMb) : undefined,
  cpuLimitCpus: canChangeResources && values.cpuLimitCpus ? Number(values.cpuLimitCpus) : undefined,
  containerArgs: canChangeContainerArgs
    ? (isRedroidRuntime
        ? applyRedroidDisplayContainerArgs(
            values.containerImage,
            values.redroidDisplayProfileId,
            values.redroidExtraArgs,
            customDisplayConfig ?? undefined
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
