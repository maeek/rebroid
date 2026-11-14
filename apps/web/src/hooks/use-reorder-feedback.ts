'use client'

import { useCallback, useEffect, type RefObject } from 'react'
import { useConfirmedFeedback } from '@/hooks/use-confirmed-feedback'
import styles from '@/shared/ui/reorder-feedback.module.css'

type MoveReceipt = { id: string; message: string; focusSlot?: string }

export const useReorderFeedback = (container: RefObject<HTMLElement | null>) => {
  const { confirmation, confirm } = useConfirmedFeedback<MoveReceipt>()
  const reportMove = useCallback(
    (id: string, name: string, position: number) => {
      const active = document.activeElement
      const focusSlot =
        active instanceof HTMLElement && active.closest('[data-reorder-id]')?.getAttribute('data-reorder-id') === id
          ? active.dataset.reorderFocus
          : undefined
      confirm({ id, message: `${name} moved to position ${position}.`, focusSlot })
    },
    [confirm]
  )

  useEffect(() => {
    if (!confirmation) return
    const row = Array.from(container.current?.querySelectorAll<HTMLElement>('[data-reorder-id]') ?? []).find(
      node => node.dataset.reorderId === confirmation.id
    )
    if (!row) return
    row.classList.add(styles.moved)
    // Menu actions keep the menu's own focus restoration. Direct controls follow the item.
    if (confirmation.focusSlot) {
      const controls = Array.from(row.querySelectorAll<HTMLElement>('[data-reorder-focus]'))
      const enabled = controls.filter(node => !node.matches(':disabled') && node.getClientRects().length > 0)
      const target =
        enabled.find(node => node.dataset.reorderFocus === confirmation.focusSlot) ??
        enabled.find(node => node.dataset.reorderFocus === 'select') ??
        enabled[0]
      target?.focus({ preventScroll: true })
    }
    row.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    return () => row.classList.remove(styles.moved)
  }, [confirmation, container])

  return { reportMove, announcement: confirmation?.message ?? '' }
}
