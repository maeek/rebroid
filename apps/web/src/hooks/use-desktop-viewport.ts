'use client'

import { useSyncExternalStore } from 'react'

export const desktopViewport = '(min-width: 64rem)'

const subscribe = (onChange: () => void) => {
  const viewport = window.matchMedia(desktopViewport)
  viewport.addEventListener('change', onChange)
  return () => viewport.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(desktopViewport).matches
const getServerSnapshot = () => null

export const useDesktopViewport = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
