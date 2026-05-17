'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AppViewer } from '../../../_components/viewer/android'
import type { AppDefinition } from '../../constants'

export const AppViewerPane = ({ app }: { app: AppDefinition }) => {
  const params = useSearchParams()
  const hideOutlineParam = params.get('hideOutline') === 'true'
  const [hideOutline, setHideOutline] = useState(() => hideOutlineParam)
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false)
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const viewerUsesOutline = !hideOutline && !isViewerFullscreen

  useEffect(() => {
    setHideOutline(hideOutlineParam)
  }, [hideOutlineParam])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsViewerFullscreen(document.fullscreenElement === viewerContainerRef.current)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const updateHideOutline = (nextHideOutline: boolean) => {
    setHideOutline(nextHideOutline)

    const url = new URL(window.location.href)

    if (nextHideOutline) {
      url.searchParams.set('hideOutline', 'true')
    } else {
      url.searchParams.delete('hideOutline')
    }

    window.history.replaceState({}, '', url.toString())
  }

  const toggleViewerFullscreen = async () => {
    if (!viewerContainerRef.current) {
      return
    }

    if (document.fullscreenElement === viewerContainerRef.current) {
      await document.exitFullscreen()
      return
    }

    await viewerContainerRef.current.requestFullscreen()
  }

  return (
    <div className='flex w-full max-w-md flex-col items-center justify-start gap-4 lg:sticky lg:top-10 lg:self-start lg:pr-4 lg:pt-6 max-sm:max-w-full'>
      <div
        ref={viewerContainerRef}
        className={cn('flex w-full items-center justify-center', {
          'h-full w-full bg-background p-6 max-sm:p-4': isViewerFullscreen
        })}
      >
        <AppViewer
          app={app}
          hideOutline={!viewerUsesOutline}
          fullscreen={isViewerFullscreen}
        />
      </div>
      <div className='flex flex-wrap items-center justify-center gap-2 pb-2'>
        <Button
          size='sm'
          variant={hideOutline ? 'default' : 'secondary'}
          disabled={isViewerFullscreen}
          onClick={() => updateHideOutline(!hideOutline)}
        >
          {hideOutline ? 'Borderless' : 'Device frame'}
        </Button>
        <Button
          size='sm'
          variant={isViewerFullscreen ? 'default' : 'secondary'}
          onClick={() => void toggleViewerFullscreen()}
        >
          {isViewerFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </Button>
      </div>
    </div>
  )
}
