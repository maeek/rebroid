'use client'

import { createContext, useContext } from 'react'
import { StateView, type StateViewAction } from '@/shared/ui/state-view'

export const DataGridEmptyContext = createContext<{
  hasSearch: boolean
  hasFilters: boolean
  disabled: boolean
  clearSearch: () => void
  clearFilters?: () => void
} | null>(null)

export const DataGridEmptyState = ({
  title = 'No items yet',
  description = 'Items will appear here when they are available.',
  actions,
  filtered: filteredOverride,
  onReset
}: {
  title?: string
  description?: string
  actions?: StateViewAction[]
  filtered?: boolean
  onReset?: () => void
}) => {
  const context = useContext(DataGridEmptyContext)
  const filtered = filteredOverride ?? (context?.hasSearch || context?.hasFilters)
  const recovery: StateViewAction[] = []
  if (context && !context.disabled) {
    if (context.hasSearch) recovery.push({ label: 'Clear search', onClick: context.clearSearch })
    if (context.hasFilters && context.clearFilters) {
      recovery.push({ label: 'Clear filters', onClick: context.clearFilters })
    }
  }
  if (onReset && !context?.disabled) recovery.push({ label: 'Reset view', onClick: onReset })
  return (
    <StateView
      scope='grid'
      kind={filtered ? 'no-results' : 'empty'}
      title={filtered ? 'No matching results' : title}
      description={filtered ? 'Try a different search or adjust the filters.' : description}
      actions={filtered ? recovery : actions}
    />
  )
}
