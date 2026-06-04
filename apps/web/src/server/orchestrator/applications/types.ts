import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-client'

export type AndroidApplication = OrchestratorApiSchemas['AndroidApplicationResponseDto']
export type ApplicationCommandResult = OrchestratorApiSchemas['ApplicationCommandResultDto']
export type AndroidApplicationSummary = OrchestratorApiSchemas['AndroidApplicationSummaryResponseDto']
export type AndroidApplicationStatus = AndroidApplication['status']['currentStatus']
export type AndroidApplicationLifecycleStage = AndroidApplication['status']['lifecycleStage']
export type AndroidApplicationStatusDetail = NonNullable<AndroidApplication['status']['detail']>
export type AndroidApplicationError = NonNullable<AndroidApplication['errors']['application']>
export type AndroidImagePullProgress = NonNullable<AndroidApplication['status']['progress']>
export type AndroidNetworkPolicyResult = NonNullable<AndroidApplication['network']['policy']['result']>
export type ScrcpyTransport = AndroidApplication['runtime']['scrcpyTransport']
export type ApplicationProfileMode = AndroidApplication['storage']['profileMode']
export type UploadedApk = OrchestratorApiSchemas['UploadedApk']
export type AndroidNotification = OrchestratorApiSchemas['AndroidNotificationDto']
export type ApplicationLog = OrchestratorApiSchemas['ApplicationLogDto']
export type ApplicationRuntimeFile = OrchestratorApiSchemas['ApplicationRuntimeFileDto']
export type ApplicationRuntimeFileUpload = OrchestratorApiSchemas['ApplicationRuntimeFileUploadDto']
export type ApplicationRuntimeFileDownload = OrchestratorApiSchemas['ApplicationRuntimeFileDownloadDto']
export type ApplicationClipboard = OrchestratorApiSchemas['ApplicationClipboardDto']
export type ApplicationScreenshot = OrchestratorApiSchemas['ApplicationScreenshotDto']
export type ApplicationViewerControlCommand = OrchestratorApiSchemas['ApplicationViewerControlDto']['command']
export type ApplicationViewerControlResponse = OrchestratorApiSchemas['ApplicationViewerControlResponseDto']
export type ScrcpySession = OrchestratorApiSchemas['ScrcpySessionDto']
export type ApplicationDisplayRecording = OrchestratorApiSchemas['DisplayRecordingDto']
export type DeleteAndroidApplicationResponse = OrchestratorApiSchemas['DeleteAndroidApplicationResponseDto']

export interface ApplicationRuntimeFilesProfileInput {
  profileMode?: ApplicationProfileMode
  profileName?: string
}

export interface RunningApplicationNotifications {
  appId: string
  appName: string
  appIcon: string | null
  appPackageName: string | null
  notifications: AndroidNotification[]
}

export interface CreateAndroidApplicationInput {
  name: string
  ownerUserId?: string
  containerImage?: string
  inactivityTimeoutSeconds?: number
  memoryLimitMb?: number
  cpuLimitCpus?: number
  containerArgs?: string
  uploadedApkId?: string
  networkPolicyEnabled?: boolean
  networkPolicyAllowCidrs?: string[]
}

export type CreateApplicationActionInput = Omit<CreateAndroidApplicationInput, 'ownerUserId'>

export type CloneApplicationInput = OrchestratorApiSchemas['CloneAndroidApplicationDto']
export type UpdateAndroidApplicationInput = OrchestratorApiSchemas['UpdateAndroidApplicationDto']
export type UpdateNetworkPolicyInput = OrchestratorApiSchemas['UpdateNetworkPolicyDto']

export interface ScrcpySessionAccess {
  control?: boolean
  clipboard?: boolean
  screenshot?: boolean
}

export type SwitchApplicationProfileInput = Partial<OrchestratorApiSchemas['SwitchApplicationProfileDto']>
