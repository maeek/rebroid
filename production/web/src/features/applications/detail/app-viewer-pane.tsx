'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { IconLoader2, IconPhoto, IconShieldLock } from '@tabler/icons-react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { AppViewer } from '@/features/applications/viewer/android'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { startApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { captureApplicationScreenshotAction } from '@/server/orchestrator/applications/read-actions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/viewer-settings'

const getToastErrorDescription = (error: unknown): string => {
  const message = error instanceof Error ? error.message.trim() : ''
  if (!message) {
    return 'The server did not return details for this failure.'
  }

  const loweredMessage = message.toLowerCase()
  if (
    loweredMessage.includes('an error occurred in the server components render') ||
    loweredMessage.includes('specific message is omitted in production builds') ||
    loweredMessage.includes('digest property is included')
  ) {
    return 'The server did not return details for this failure.'
  }

  if (loweredMessage === 'failed to fetch' || loweredMessage.includes('fetch failed')) {
    return 'Could not reach the server.'
  }

  return message
}

export const AppViewerPane = ({
  app,
  canAttach = true,
  canCaptureScreenshot = false,
  canStart = false,
  viewerSettings,
  onAppChange
}: {
  app: AppDefinition
  canAttach?: boolean
  canCaptureScreenshot?: boolean
  canStart?: boolean
  viewerSettings: ViewerSettings
  onAppChange: (app: AppDefinition) => void
}) => {
  const params = useSearchParams()
  const hideOutlineParam = params.get('hideOutline') === 'true'
  const [hideOutline, setHideOutline] = useState(() => hideOutlineParam)
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false)
  const [isStarting, startTransition] = useTransition()
  const [isCapturing, startScreenshotTransition] = useTransition()
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const viewerUsesOutline = !hideOutline && !isViewerFullscreen
  const runtimeAvailable = app.status === 'running'

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

  const handleStart = () => {
    if (!canStart || !canAttach) {
      return
    }

    startTransition(async () => {
      try {
        const nextApp = await startApplicationAction(app.id)
        onAppChange(mapAndroidApplicationToAppDefinition(nextApp))
      } catch (error) {
        toast({
          title: 'Could not start app',
          description: getToastErrorDescription(error),
          variant: 'destructive'
        })
      }
    })
  }

  const handleScreenshotCapture = () => {
    if (!canAttach || !canCaptureScreenshot || !runtimeAvailable) {
      return
    }

    startScreenshotTransition(async () => {
      try {
        const screenshot = await captureApplicationScreenshotAction(app.id)
        const link = document.createElement('a')
        const timestamp = screenshot.capturedAt.replace(/[:.]/g, '-')

        link.href = screenshot.dataUrl
        link.download = `${app.name}-${timestamp}.png`
        document.body.appendChild(link)
        link.click()
        link.remove()
      } catch (error) {
        toast({
          title: 'Could not capture screenshot',
          description: getToastErrorDescription(error),
          variant: 'destructive'
        })
      }
    })
  }

  return (
    <div className='flex w-full max-w-md flex-col items-center justify-start gap-4 lg:sticky lg:top-10 lg:self-start lg:pr-4 lg:pt-6 max-sm:max-w-full'>
      <div
        ref={viewerContainerRef}
        className={cn('flex w-full items-center justify-center', {
          'h-full w-full bg-background p-6 max-sm:p-4': isViewerFullscreen
        })}
      >
        <Visible when={canAttach}>
          <AppViewer
            app={app}
            hideOutline={!viewerUsesOutline}
            fullscreen={isViewerFullscreen}
            viewerSettings={viewerSettings}
            canStart={canStart}
            isStarting={isStarting}
            onStart={handleStart}
          />
        </Visible>
        <Visible when={!canAttach}>
          <div className='flex min-h-112 w-full items-center justify-center rounded-4xl border border-white/10 bg-card/55 p-6 backdrop-blur-xl'>
            <StatusSplash
              title='Separate session required'
              description='This app belongs to another user. Open it as your own copy to start a private container and viewer session.'
              icon={<IconShieldLock className='size-10' />}
            />
          </div>
        </Visible>
      </div>
      <Visible when={canAttach}>
        <div className='flex flex-wrap items-center justify-center gap-2 pb-2'>
          <Visible when={canCaptureScreenshot}>
            <Button
              size='icon'
              variant='secondary'
              disabled={!runtimeAvailable || isCapturing}
              onClick={handleScreenshotCapture}
              aria-label='Capture screenshot'
              title='Capture screenshot'
            >
              {isCapturing ? <IconLoader2 className='size-4 animate-spin' /> : <IconPhoto className='size-4' />}
            </Button>
          </Visible>
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
      </Visible>
    </div>
  )
}
