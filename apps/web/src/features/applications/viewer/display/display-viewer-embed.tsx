'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/android-application-core/redroid-runtime'
import { IconAlertTriangle, IconDeviceDesktop, IconLoader2 } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { DisplayViewerProvider } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { DisplayViewerShell } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-shell'
import {
  getViewerStartupDeadline,
  redroidViewerRefreshIntervalMs
} from '@/features/applications/viewer/display/display-viewer-startup'
import { buildDisplayViewerSurfaces } from '@/features/applications/viewer/display/display-viewer-surfaces'
import {
  getViewerFrameClassName,
  getViewerFrameLayout,
  getViewerFrameStyle
} from '@/features/applications/viewer/player/android-viewer-layout'
import { ViewerPlaceholderScreen } from '@/features/applications/viewer/player/viewer-placeholder-screen'
import { getToastErrorDescription } from '@/features/applications/viewer/utils/viewer-error-utils'
import { cn } from '@/lib/utils'
import { getScrcpySessionAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import { StateView } from '@/shared/ui/state-view'
import { ViewerActivityKeepalive } from './viewer-activity-keepalive'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { DisplayViewerStreamMetrics } from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { ViewerOrientation } from '@/features/applications/viewer/player/android-viewer'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { ScrcpySession } from '@/shared/contracts/application'

const useBrowserBaseUrl = () => {
  const [baseUrl, setBaseUrl] = useState('http://localhost')

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  return baseUrl
}

const EmbeddedViewerSplash = ({
  title,
  description,
  detail,
  tone = 'default',
  icon
}: {
  title: string
  description: string
  detail?: string | null
  tone?: 'default' | 'danger'
  icon?: ReactNode
}) => (
  <div className='flex min-h-136 w-full items-center justify-center p-6'>
    <StateView
      kind={tone === 'danger' ? 'error' : 'unavailable'}
      scope='grid'
      title={title}
      description={description}
      detail={detail}
      icon={
        icon ??
        (tone === 'danger' ? <IconAlertTriangle className='size-10' /> : <IconDeviceDesktop className='size-10' />)
      }
      className='min-h-full'
    />
  </div>
)

const viewerOrientation = (app: AppDefinition): ViewerOrientation => {
  const display = getRedroidDisplayDimensionsFromArgs(app.containerArgs)
  return display.width >= display.height ? 'landscape' : 'portrait'
}

const EmbeddedViewerFallback = ({
  app,
  loadingDescription,
  actions,
  children
}: {
  app: AppDefinition
  loadingDescription: string
  actions?: ReactNode
  children?: ReactNode
}) => {
  const layout = getViewerFrameLayout(app, viewerOrientation(app))

  return (
    <div className='flex w-full items-center justify-center'>
      <div
        className={children ? 'relative w-full' : getViewerFrameClassName(false)}
        style={children ? undefined : getViewerFrameStyle(layout, false)}
      >
        {actions ? (
          <div
            className={cn(
              'flex h-8 items-center justify-end bg-surface-band px-1.5',
              children ? 'rounded-t-panel' : 'absolute inset-x-0 top-0 z-20'
            )}
          >
            {actions}
          </div>
        ) : null}
        {children ?? (
          <ViewerPlaceholderScreen
            app={app}
            placeholder={{
              title: 'Starting live display',
              description: loadingDescription,
              toneClassName: 'text-primary',
              Icon: IconLoader2,
              showSpinner: true,
              showProgress: false
            }}
          />
        )}
      </div>
    </div>
  )
}

export const DisplayViewerEmbed = ({
  app,
  viewerSettings,
  canControlViewer,
  canCaptureScreenshot,
  onViewerSettingsChange,
  onStreamMetrics,
  streamingSettings,
  clipboard
}: {
  app: AppDefinition
  viewerSettings: ViewerSettings
  canControlViewer: boolean
  canCaptureScreenshot: boolean
  onViewerSettingsChange?: (settings: ViewerSettings) => void
  streamingSettings?: ReactNode
  clipboard?: ReactNode
  onStreamMetrics?: (surfaceId: string, metrics: DisplayViewerStreamMetrics) => void
}) => {
  const baseUrl = useBrowserBaseUrl()
  const [session, setSession] = useState<ScrcpySession | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [reload, setReload] = useState({ runtime: '', count: 0 })
  const startedAt = app.lastStartedAt?.getTime() ?? null
  const runtime = `${app.id}:${startedAt}`
  const reloadCount = reload.runtime === runtime ? reload.count : 0

  useEffect(() => {
    if (app.status !== 'running') {
      setSession(null)
      setSessionError(null)
      return
    }

    let active = true
    let retryTimer: number | null = null
    const deadline = getViewerStartupDeadline(startedAt)

    const scheduleStartupRetry = () => {
      if (reloadCount !== 0 || !deadline || Date.now() + redroidViewerRefreshIntervalMs >= deadline.getTime()) {
        return false
      }
      retryTimer = window.setTimeout(() => {
        if (Date.now() < deadline.getTime()) {
          void loadSession()
        } else {
          setSessionError(current => current ?? 'The display service could not create a viewer session.')
        }
      }, redroidViewerRefreshIntervalMs)
      return true
    }

    const loadSession = async () => {
      try {
        const nextSession = await getScrcpySessionAction(app.id)
        if (!active) {
          return
        }

        setSession(nextSession)
        setSessionError(
          nextSession.displaySession?.viewerPath || scheduleStartupRetry()
            ? null
            : 'The display service could not create a viewer session.'
        )
      } catch (error) {
        if (!active) {
          return
        }

        setSessionError(getToastErrorDescription(error))
        scheduleStartupRetry()
      }
    }

    void loadSession()

    return () => {
      active = false
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer)
      }
    }
  }, [app.id, app.status, startedAt, reloadCount])

  const mainDisplaySize = useMemo(() => getRedroidDisplayDimensionsFromArgs(app.containerArgs), [app.containerArgs])
  const surfaces = useMemo(
    () =>
      session
        ? buildDisplayViewerSurfaces({
            session,
            baseUrl,
            soundEnabled: viewerSettings.soundEnabled,
            settings: viewerSettings,
            mainDisplaySize,
            controlsEnabled: false
          })
        : [],
    [baseUrl, mainDisplaySize, session, viewerSettings]
  )

  if (!session?.viewerServiceConfigured || !session.displaySession?.viewerPath || surfaces.length === 0) {
    let error: { description: string; detail: string } | undefined
    if (session && !session.viewerServiceConfigured) {
      error = {
        description: 'The live display service is not ready.',
        detail: 'Refresh the viewer or restart the app, then try again.'
      }
    } else if (sessionError) {
      error = { description: 'The live display session could not be opened.', detail: sessionError }
    }

    return (
      <EmbeddedViewerFallback
        app={app}
        loadingDescription={session ? 'Preparing the display session.' : 'Rebroid is opening the app screen.'}
        actions={streamingSettings}
      >
        {error ? (
          <EmbeddedViewerSplash
            title='Viewer unavailable'
            description={error.description}
            detail={error.detail}
            tone='danger'
          />
        ) : null}
      </EmbeddedViewerFallback>
    )
  }

  return (
    <div className='relative h-[var(--app-viewer-height,calc(100dvh-6rem))] min-h-0 w-full overflow-hidden'>
      <ViewerActivityKeepalive applicationId={session.applicationId} />
      <Visible when={!session.viewerTargetConnected}>
        <div className='pointer-events-none absolute left-3 right-3 top-10 z-20 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning backdrop-blur-md'>
          Viewer connection could not be confirmed yet.
        </div>
      </Visible>
      <DisplayViewerProvider
        value={{
          applicationId: session.applicationId,
          surfaces,
          initialKeyboardCaptureEnabled: viewerSettings.keyboardCaptureEnabled,
          controlsEnabled: true,
          canControl: canControlViewer && session.displaySession.capabilities.includes('control'),
          canCaptureScreenshot: canCaptureScreenshot && session.displaySession.capabilities.includes('screenshot'),
          onSurfacesChanged: () =>
            setReload(current => ({ runtime, count: current.runtime === runtime ? current.count + 1 : 1 })),
          onKeyboardCaptureChange: enabled => {
            onViewerSettingsChange?.({
              ...viewerSettings,
              keyboardCaptureEnabled: enabled
            })
          },
          onStreamMetrics
        }}
      >
        <DisplayViewerShell
          className='h-full w-full !bg-transparent'
          streamingSettings={streamingSettings}
          clipboard={clipboard}
          miniPlayerEnabled
        />
      </DisplayViewerProvider>
    </div>
  )
}
