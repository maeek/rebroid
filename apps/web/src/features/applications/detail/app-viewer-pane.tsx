'use client'

import { useEffect, useState, useTransition } from 'react'
import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/application-core/redroid-runtime'
import { IconShieldLock } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { DisplayViewerEmbed } from '@/features/applications/viewer/display/display-viewer-embed'
import { AppViewer } from '@/features/applications/viewer/player/android-viewer'
import { getToastErrorDescription } from '@/features/applications/viewer/utils/viewer-error-utils'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { startApplicationAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { StatusSplash } from '@/shared/ui/status-splash'
import { useApplicationViewerApp } from './application-viewer-context'
import type { ViewerOrientation } from '@/features/applications/viewer/player/android-viewer'

export const AppViewerPane = ({ placement = 'side' }: { placement?: 'side' | 'top' }) => {
  const {
    app,
    canAttach,
    canCaptureScreenshot,
    canControlViewer,
    canStartCurrentApp,
    setApp,
    setViewerStreamMetrics,
    setViewerSettings,
    viewerSettings
  } = useApplicationViewerApp()
  const [orientation, setOrientation] = useState<ViewerOrientation>(() => {
    const display = getRedroidDisplayDimensionsFromArgs(app.containerArgs)
    return display.width >= display.height ? 'landscape' : 'portrait'
  })
  const [isStarting, startTransition] = useTransition()
  const runtimeAvailable = app.status === 'running'
  const useDisplayWorkspace = canAttach && runtimeAvailable

  useEffect(() => {
    const display = getRedroidDisplayDimensionsFromArgs(app.containerArgs)
    setOrientation(display.width >= display.height ? 'landscape' : 'portrait')
  }, [app.containerArgs, app.id])

  const handleStart = () => {
    if (!canStartCurrentApp || !canAttach) {
      return
    }

    startTransition(async () => {
      try {
        const nextApp = await startApplicationAction(app.id)
        setApp(mapAndroidApplicationToAppDefinition(nextApp))
      } catch (error) {
        toast({
          title: 'Could not start app',
          description: getToastErrorDescription(error),
          variant: 'danger'
        })
      }
    })
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-start gap-4 max-sm:max-w-full',
        {
          'max-w-none lg:sticky lg:top-10 lg:min-w-0 lg:flex-1 lg:self-stretch lg:pr-4 lg:pt-6':
            placement === 'side' && useDisplayWorkspace,
          'max-w-[min(100%,42rem)] lg:sticky lg:top-10 lg:self-start lg:pr-4 lg:pt-6':
            placement === 'side' && !useDisplayWorkspace,
          'max-w-none': placement === 'top'
        },
        'max-sm:px-1'
      )}
    >
      <div className='relative flex w-full items-center justify-center'>
        <Visible when={canAttach && runtimeAvailable}>
          <DisplayViewerEmbed
            key={app.id}
            app={app}
            viewerSettings={viewerSettings}
            canControlViewer={canControlViewer}
            canCaptureScreenshot={canCaptureScreenshot}
            onViewerSettingsChange={setViewerSettings}
            onStreamMetrics={(surfaceId, metrics) =>
              setViewerStreamMetrics(current => ({
                ...current,
                [surfaceId]: metrics
              }))
            }
          />
        </Visible>
        <Visible when={canAttach && !runtimeAvailable}>
          <AppViewer
            app={app}
            fullscreen={false}
            orientation={orientation}
            viewerSettings={viewerSettings}
            canStart={canStartCurrentApp}
            isStarting={isStarting}
            onStart={handleStart}
          />
        </Visible>
        <Visible when={!canAttach}>
          <div className='flex min-h-112 w-full items-center justify-center rounded-feature border border-white/10 bg-surface-panel/64 p-6 backdrop-blur-xl'>
            <StatusSplash
              title='Separate session required'
              description='This app belongs to another user. Open it as your own copy to start a private viewer session.'
              icon={<IconShieldLock className='size-10' />}
            />
          </div>
        </Visible>
      </div>
    </div>
  )
}
