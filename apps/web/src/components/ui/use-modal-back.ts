import { useRef, useState, type RefObject } from 'react'
import { useBackLayer } from '@/hooks/use-back-layer'

type Actions = { close: () => void; unmount: () => void }

export const useModalBack = <Event extends { isCanceled: boolean }>({
  open: controlledOpen,
  defaultOpen = false,
  modal,
  onOpenChange,
  actionsRef
}: {
  open?: boolean
  defaultOpen?: boolean
  modal?: boolean | 'trap-focus'
  onOpenChange?: (open: boolean, event: Event) => void
  actionsRef?: RefObject<Actions | null>
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const localActions = useRef<Actions | null>(null)
  const actions = actionsRef ?? localActions
  const open = controlledOpen ?? uncontrolledOpen
  useBackLayer(open && modal !== false, () => actions.current?.close())

  return {
    open,
    actionsRef: actions,
    onOpenChange: (nextOpen: boolean, event: Event) => {
      onOpenChange?.(nextOpen, event)
      if (controlledOpen === undefined && !event.isCanceled) setUncontrolledOpen(nextOpen)
    }
  }
}
