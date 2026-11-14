import type { MouseEvent, MouseEventHandler } from 'react'

export type MenuSelectEvent = MouseEvent<HTMLElement> & {
  preventBaseUIHandler?: () => void
}

export const handleMenuSelect = (
  event: MenuSelectEvent,
  onSelect?: (event: MenuSelectEvent) => void,
  onClick?: MouseEventHandler<HTMLElement>
) => {
  const preventDefault = event.preventDefault
  let canceled = false
  // Base UI already prevents native defaults when synthesizing keyboard activation.
  // Only cancellation requested by our selection handlers should keep the menu open.
  event.preventDefault = () => {
    canceled = true
    preventDefault.call(event)
  }
  try {
    onSelect?.(event)
    onClick?.(event)
  } finally {
    event.preventDefault = preventDefault
    if (canceled) event.preventBaseUIHandler?.()
  }
}
