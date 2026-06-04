'use client'

import { useEffect, useState } from 'react'

export const useFullscreenState = () => {
  const [fullscreenElement, setFullscreenElement] = useState<Element | null>(null)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreenElement(document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = async (element?: HTMLElement | null) => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    await (element ?? document.documentElement).requestFullscreen()
  }

  return { fullscreen: Boolean(fullscreenElement), fullscreenElement, toggleFullscreen }
}
