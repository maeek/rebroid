import { createContext, useContext } from 'react'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AppsListSortMode } from '@/features/applications/domain/app-sort'

export type BulkAction = 'stop' | 'delete'
export type PendingAppAction = { action: BulkAction; app: AppDefinition }

export type AppsListContextValue = {
  activeBulkApps: AppDefinition[]
  allSelected: boolean
  bulkAction: BulkAction | null
  closeBulkAction: () => void
  confirmBulkAction: () => Promise<void>
  deleteApp: (app: AppDefinition) => Promise<void>
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
  startApp: (app: AppDefinition) => Promise<void>
  startManaging: () => void
  stopApp: (app: AppDefinition) => Promise<void>
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
