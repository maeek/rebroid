import { createContext, useContext } from 'react'
import type { AppGalleryItem } from '@/shared/contracts/application-gallery'
import type { AppsListSortMode } from '@/shared/model/applications/app-sort'

export type BulkAction = 'stop' | 'delete'
export type PendingAppAction = { action: BulkAction; app: AppGalleryItem }
export type BulkAppProgress = {
  apps: AppGalleryItem[]
  removeDataOnDelete: boolean
  accepted: number
  failed: number
}

export type AppsListContextValue = {
  activeBulkApps: AppGalleryItem[]
  allSelected: boolean
  bulkAction: BulkAction | null
  bulkProgress: BulkAppProgress | null
  canStop: boolean
  canDelete: boolean
  closeBulkAction: () => void
  confirmBulkAction: () => Promise<void>
  deleteApp: (app: AppGalleryItem) => Promise<void>
  deletableSelectedCount: number
  exitManageMode: () => void
  isBulkWorking: boolean
  isManaging: boolean
  openBulkAction: (action: BulkAction) => void
  openPendingAppAction: (pendingAction: PendingAppAction) => void
  pendingAppAction: PendingAppAction | null
  closePendingAppAction: () => void
  confirmPendingAppAction: () => Promise<void>
  removeDataOnDelete: boolean
  selectedIds: Set<string>
  selectionCount: number
  setSortMode: (sortMode: AppsListSortMode) => void
  startApp: (app: AppGalleryItem) => Promise<void>
  startManaging: (initialId?: string) => void
  stopApp: (app: AppGalleryItem) => Promise<void>
  sortMode: AppsListSortMode
  stoppableSelectedCount: number
  toggleSelected: (id: string) => void
  toggleSelectAll: () => void
}

const AppsListContext = createContext<AppsListContextValue | null>(null)

export const AppsListProvider = AppsListContext.Provider

export const useAppsListContext = () => {
  const context = useContext(AppsListContext)

  if (!context) {
    throw new Error('useAppsListContext must be used within AppsListProvider')
  }

  return context
}
