'use client'

import { useMemo, useState } from 'react'

export const useGridSelection = <T extends { id: string }>(items: T[]) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  const selectedItems = useMemo(() => items.filter(item => selectedIds.has(item.id)), [items, selectedIds])

  const clearSelection = () => {
    setSelectedIds(new Set())
    setLastSelectedIndex(null)
  }

  const toggleSelection = (item: T, index: number, shiftKey: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        for (const rangeItem of items.slice(start, end + 1)) {
          next.add(rangeItem.id)
        }
      } else if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.add(item.id)
      }

      return next
    })
    setLastSelectedIndex(index)
  }

  const selectPage = (pageItems: T[], selected: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current)
      for (const item of pageItems) {
        if (selected) {
          next.add(item.id)
        } else {
          next.delete(item.id)
        }
      }
      return next
    })
  }

  return {
    selectedIds,
    selectedItems,
    clearSelection,
    toggleSelection,
    selectPage
  }
}
