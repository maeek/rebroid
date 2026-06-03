export type AppFormValues = {
  name: string
  containerImage: string
  inactivityTimeoutSeconds: number
  memoryLimitMb: string
  cpuLimitCpus: string
  customContainerArgs: string
  redroidDisplayProfileId: string
  redroidCustomDisplayWidth: string
  redroidCustomDisplayHeight: string
  redroidCustomDisplayDpi: string
  redroidExtraArgs: string
}

export type CreateAppFormValues = AppFormValues & {
  networkPolicyEnabled: boolean
  networkPolicyAllowCidrs: string[]
}
