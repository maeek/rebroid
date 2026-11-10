'use client'

import { useEffect, useRef, useState } from 'react'

export const useViewerMiniPlayer = (enabled: boolean) => {
  const anchorRef = useRef<HTMLDivElement>(null)
  const dismissed = useRef(false)
  const [floating, setFloating] = useState(false)

  useEffect(() => {
    const anchor = anchorRef.current
    if (!enabled || !anchor || typeof IntersectionObserver === 'undefined') return

    const desktop = window.matchMedia('(min-width: 1024px)')
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.rootBounds) return
      const aboveViewport = entry.boundingClientRect.bottom <= entry.rootBounds.top
      if (entry.isIntersecting) dismissed.current = false
      setFloating(desktop.matches && aboveViewport && !dismissed.current)
    })
    const observe = () => {
      observer.disconnect()
      if (desktop.matches) observer.observe(anchor)
      else setFloating(false)
    }
    observe()
    desktop.addEventListener('change', observe)
    return () => {
      observer.disconnect()
      desktop.removeEventListener('change', observe)
    }
  }, [enabled])

  const dockPlayer = () => {
    dismissed.current = true
    setFloating(false)
    anchorRef.current?.closest('main')?.focus({ preventScroll: true })
  }

  return { anchorRef, floating: enabled && floating, dockPlayer }
}
