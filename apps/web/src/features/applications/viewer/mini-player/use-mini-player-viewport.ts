'use client'

import { useLayoutEffect, useState } from 'react'

export const useMiniPlayerViewport = (enabled: boolean) => {
  const [viewport, setViewport] = useState({ width: 0, height: 0, rem: 16 })
  useLayoutEffect(() => {
    if (!enabled) return
    const update = () => {
      const next = {
        width: document.documentElement.clientWidth || window.innerWidth,
        height: window.innerHeight,
        rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      }
      setViewport(current =>
        current.width === next.width && current.height === next.height && current.rem === next.rem ? current : next
      )
    }
    update()
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(document.documentElement)
    return () => {
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [enabled])
  return viewport
}
