'use client'

import { useLayoutEffect, useRef } from 'react'
import { registerBackLayer } from '@/lib/navigation/back-layers'
import { desktopViewport } from './use-desktop-viewport'

export const useBackLayer = (
  active: boolean,
  onBack: () => void | 'continue',
  priority: 'guard' | 'screen' | 'overlay' = 'overlay'
) => {
  const callback = useRef(onBack)
  useLayoutEffect(() => {
    callback.current = onBack
  }, [onBack])

  useLayoutEffect(() => {
    if (!active) return
    const media = window.matchMedia?.(desktopViewport)
    if (!media) return
    let unregister: (() => void) | undefined
    const update = () => {
      if (media.matches) {
        unregister?.()
        unregister = undefined
      } else {
        unregister ??= registerBackLayer(priority, () => callback.current())
      }
    }
    update()
    media.addEventListener?.('change', update)
    return () => {
      media.removeEventListener?.('change', update)
      unregister?.()
    }
  }, [active, priority])
}
