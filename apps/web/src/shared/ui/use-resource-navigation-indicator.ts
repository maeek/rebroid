'use client'

import { useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { ResourceNavigationMotionContext } from './resource-navigation-motion-scope'

const indicatorPosition = (item: HTMLElement) =>
  `translate(${item.offsetLeft + item.offsetWidth / 2 - 12}px, ${item.offsetTop + item.offsetHeight - 2}px)`

export const useResourceNavigationIndicator = <T extends HTMLElement>(
  currentId: string | undefined,
  scope: string,
  enabled = true
) => {
  const containerRef = useRef<T>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const previousId = useRef<string | undefined>(undefined)
  const animation = useRef<Animation | null>(null)
  const interruptedAnimation = useRef<Animation | null>(null)
  const history = useContext(ResourceNavigationMotionContext)

  useLayoutEffect(() => {
    const container = containerRef.current
    const indicator = indicatorRef.current
    if (!enabled || !container || !indicator) return
    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-resource-item]'))
    const current = items.find(item => item.dataset.resourceItem === currentId)
    if (!current) {
      animation.current?.cancel()
      delete container.dataset.indicatorReady
      previousId.current = undefined
      history?.current.delete(scope)
      return
    }

    const lastId = previousId.current ?? history?.current.get(scope)
    const previous = items.find(item => item.dataset.resourceItem === lastId)
    const target = indicatorPosition(current)
    let origin = previous ? indicatorPosition(previous) : target
    if (animation.current?.playState === 'running') origin = getComputedStyle(indicator).transform
    container.dataset.indicatorReady = 'true'
    if (lastId !== currentId || indicator.style.transform !== target) {
      animation.current?.cancel()
      indicator.style.transform = target
      if (
        previous &&
        lastId !== currentId &&
        window.matchMedia &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        indicator.animate
      ) {
        animation.current = indicator.animate([{ transform: origin }, { transform: target }], {
          duration: 180,
          easing: 'cubic-bezier(0.2, 0, 0, 1)'
        })
      }
    }
    previousId.current = currentId
    if (currentId) history?.current.set(scope, currentId)

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const position = indicatorPosition(current)
      if (indicator.style.transform === position) return
      animation.current?.cancel()
      indicator.style.transform = position
    })
    observer.observe(container)
    items.forEach(item => observer.observe(item))
    return () => observer.disconnect()
  })

  useEffect(() => {
    if (!enabled || !window.matchMedia) {
      interruptedAnimation.current = null
      return
    }
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    // Strict Mode replays mount effects after cleanup cancels the active glide.
    if (interruptedAnimation.current === animation.current && !preference.matches) {
      interruptedAnimation.current?.play()
    }
    interruptedAnimation.current = null
    const cancel = () => animation.current?.cancel()
    preference.addEventListener('change', cancel)
    return () => {
      interruptedAnimation.current = animation.current?.playState === 'running' ? animation.current : null
      preference.removeEventListener('change', cancel)
      cancel()
    }
  }, [enabled])

  return { containerRef, indicatorRef }
}
