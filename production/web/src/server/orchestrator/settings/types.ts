import type { ScrcpyTransport } from '../applications/types'

export interface CleanupUploadedApksResponse {
  deletedRecords: number
  removedFiles: number
}

export interface OrchestratorSettingsResponse {
  defaultContainerImage: string
  defaultScrcpyTransport: ScrcpyTransport
  defaultInactivityTimeoutSeconds: number
  maxApkUploadSizeMb: number
  imagePruneIntervalHours: number
  imagePruneDanglingOnly: boolean
}
