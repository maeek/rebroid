'use client'

import { useLayoutEffect, useState, type CSSProperties } from 'react'

const hidden: CSSProperties = { display: 'none' }

export const useDockedViewerPosition = (element: HTMLDivElement, floating: boolean, fullscreen: boolean) => {
  const [position, setPosition] = useState<CSSProperties>(hidden)

  useLayoutEffect(() => {
    if (floating || fullscreen) return
    const workspace = element.closest('[data-display-workspace]')
    let frame = 0
    const update = () => {
      const rect = element.getBoundingClientRect()
      const bounds = workspace?.getBoundingClientRect()
      if (!element.isConnected || rect.width <= 0 || rect.height <= 0) {
        setPosition(hidden)
        return
      }

      const top = Math.max(0, (bounds?.top ?? 0) - rect.top)
      const right = Math.max(0, rect.right - (bounds?.right ?? window.innerWidth))
      const bottom = Math.max(0, rect.bottom - (bounds?.bottom ?? window.innerHeight))
      const left = Math.max(0, (bounds?.left ?? 0) - rect.left)
      const clipPath = top || right || bottom || left ? `inset(${top}px ${right}px ${bottom}px ${left}px)` : undefined
      const next = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, clipPath, zIndex: 1 }
      setPosition(current =>
        current.left === next.left &&
        current.top === next.top &&
        current.width === next.width &&
        current.height === next.height &&
        current.clipPath === next.clipPath
          ? current
          : next
      )
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }

    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule)
    resize?.observe(element)
    if (workspace) resize?.observe(workspace)
    if (document.body) resize?.observe(document.body)
    const intersection = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(schedule)
    intersection?.observe(element)
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    update()
    return () => {
      window.cancelAnimationFrame(frame)
      resize?.disconnect()
      intersection?.disconnect()
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [element, floating, fullscreen])

  return position
}
