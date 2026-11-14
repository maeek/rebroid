export interface PlatformOperationItem {
  id: string
  name: string
  impact: string
  href: string
}

export interface PlatformOperationsSnapshot {
  collectedAt: string
  failedCount: number
  pendingCount: number
  activeRunCount: number | null
  workflowCatalogAvailable: boolean
  activeRuns: PlatformOperationItem[]
}
