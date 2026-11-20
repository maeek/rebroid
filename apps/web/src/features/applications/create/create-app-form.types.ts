import type { AppRuntimeSettingsDraft } from '../model/app-runtime-settings'

export type CreateAppFormValues = AppRuntimeSettingsDraft & {
  name: string
  containerImage: string
  customContainerArgs: string
  redroidDisplayProfileId: string
  redroidCustomDisplayWidth: string
  redroidCustomDisplayHeight: string
  redroidCustomDisplayDpi: string
  redroidExtraArgs: string
  networkPolicyEnabled: boolean
  networkPolicyAllowCidrs: string[]
}
