'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/android-application-core/redroid-runtime'
import { IconShieldLock } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { applyApplicationPowerAcknowledgement } from '@/features/applications/domain/app-mapper'
import { DisplayViewerEmbed } from '@/features/applications/viewer/display/display-viewer-embed'
import { ViewerClipboard } from '@/features/applications/viewer/display/display-viewer-shell/surface/viewer-clipboard'
import { AppViewer } from '@/features/applications/viewer/player/android-viewer'
import { getToastErrorDescription } from '@/features/applications/viewer/utils/viewer-error-utils'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { requestApplicationStartAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { hasPermission } from '@/shared/permissions/permissions'
import { StateView } from '@/shared/ui/state-view'
import { AppViewerStreamingSettings } from './app-viewer-streaming-settings'
import { useApplicationViewerApp } from './application-viewer-context'
import type { ViewerOrientation } from '@/features/applications/viewer/player/android-viewer'

export const AppViewerPane = ({ placement = 'side' }: { placement?: 'side' | 'top' }) => {
  const {
    app,
    canAttach,
    canCaptureScreenshot,
    canControlViewer,
    canStartCurrentApp,
    isForeignOwnedApp,
    permissions,
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
        const command = unwrapActionResult(await requestApplicationStartAction(app.id))
        setApp(current => {
          if (current?.id !== app.id || current.updatedAt.getTime() > app.updatedAt.getTime()) return current
          return applyApplicationPowerAcknowledgement(current, command)
        })
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
    <AppViewerPaneLayout
      placement={placement}
      workspace={useDisplayWorkspace}
    >
      <div className='relative flex w-full min-h-0 items-center justify-center'>
        <Visible when={canAttach && runtimeAvailable}>
          <DisplayViewerEmbed
            key={app.id}
            app={app}
            viewerSettings={viewerSettings}
            streamingSettings={<AppViewerStreamingSettings />}
            clipboard={
              !isForeignOwnedApp && hasPermission(permissions, 'applications:sync-clipboard') ? (
                <ViewerClipboard appId={app.id} />
              ) : null
            }
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
            chrome={<AppViewerStreamingSettings />}
            viewerSettings={viewerSettings}
            canStart={canStartCurrentApp}
            isStarting={isStarting}
            onStart={handleStart}
          />
        </Visible>
        <Visible when={!canAttach}>
          <div className='flex min-h-112 w-full items-center justify-center rounded-feature border border-white/10 bg-surface-panel/64 p-6 backdrop-blur-xl'>
            <StateView
              kind='unavailable'
              scope='grid'
              title='Separate session required'
              description='This app belongs to another user. Open it as your own copy to start a private viewer session.'
              icon={<IconShieldLock className='size-10' />}
            />
          </div>
        </Visible>
      </div>
    </AppViewerPaneLayout>
  )
}

export const AppViewerPaneLayout = ({
  placement = 'side',
  workspace = false,
  children
}: {
  placement?: 'side' | 'top'
  workspace?: boolean
  children: ReactNode
}) => (
  <div
    className={cn(
      'flex w-full flex-col items-center justify-start gap-3 max-sm:max-w-full',
      {
        'max-w-none lg:sticky lg:top-10 lg:min-w-0 lg:flex-1 lg:self-stretch lg:pr-4 lg:pt-6':
          placement === 'side' && workspace,
        'max-w-[min(100%,42rem)] lg:sticky lg:top-10 lg:self-start lg:pr-4 lg:pt-6': placement === 'side' && !workspace,
        'max-w-none': placement === 'top'
      },
      'max-sm:px-1'
    )}
  >
    {children}
  </div>
)
