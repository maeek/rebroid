export type CreateAppFormValues = {
  name: string
  containerImage: string
  inactivityTimeoutSeconds: number
  memoryLimitMb: string
  cpuLimitCpus: string
  volumeSizeLimitMb: string
  customContainerArgs: string
  redroidDisplayProfileId: string
  redroidExtraArgs: string
}
