'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/android-application-core/redroid-runtime'
import { IconLoader2 } from '@tabler/icons-react'
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
import type {
  DisplayViewerStreamMetrics,
  ViewerFrameObservation
} from '@/features/applications/viewer/display/display-viewer-stream-status'
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

const viewerOrientation = (app: AppDefinition): ViewerOrientation => {
  const display = getRedroidDisplayDimensionsFromArgs(app.containerArgs)
  return display.width >= display.height ? 'landscape' : 'portrait'
}

const EmbeddedViewerFallback = ({
  app,
  loadingDescription,
  streamingSettings,
  error,
  onRetry
}: {
  app: AppDefinition
  loadingDescription: string
  streamingSettings?: ReactNode
  error?: { description: string; detail?: string }
  onRetry: () => void
}) => {
  const layout = getViewerFrameLayout(app, viewerOrientation(app))

  return (
    <div className='flex w-full items-center justify-center'>
      <div
        data-viewer-frame
        role='region'
        aria-label='Android display'
        className={cn(getViewerFrameClassName(false), 'flex-col')}
        style={getViewerFrameStyle(layout, false)}
      >
        {streamingSettings ? (
          <div className='viewer-chrome flex h-[var(--viewer-chrome-height)] w-full shrink-0 items-center justify-end bg-surface-band px-1.5'>
            {streamingSettings}
          </div>
        ) : null}
        <div className='flex min-h-0 w-full flex-1 flex-col overflow-auto bg-surface-panel'>
          {error ? (
            <StateView
              kind='error'
              scope='grid'
              title='Viewer unavailable'
              description={error.description}
              detail={error.detail}
              actions={[{ label: 'Try again', onClick: onRetry }]}
              className='my-auto shrink-0'
            />
          ) : (
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
  onFirstFrame,
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
  onFirstFrame?: (observation?: ViewerFrameObservation, requestAt?: number) => void
}) => {
  const baseUrl = useBrowserBaseUrl()
  const [sessionRecord, setSessionRecord] = useState<{
    runtime: string
    requestAt: number
    value: ScrcpySession
  } | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [surfaceRefreshVersion, setSurfaceRefreshVersion] = useState(0)
  const [reload, setReload] = useState({ runtime: '', count: 0 })
  const startedAt = app.lastStartedAt?.getTime() ?? null
  const runtime = `${app.id}:${app.containerId}:${startedAt}`
  const currentSession = sessionRecord?.runtime === runtime ? sessionRecord : null
  const session = currentSession?.value
  const reloadCount = reload.runtime === runtime ? reload.count : 0
  const reloadSession = () =>
    setReload(current => ({ runtime, count: current.runtime === runtime ? current.count + 1 : 1 }))
  const getStartupDeadline = useEffectEvent(() =>
    getViewerStartupDeadline(startedAt, app.provisioningCompletedAt?.getTime() ?? null)
  )

  useEffect(() => {
    if (app.status !== 'running') {
      setSessionRecord(null)
      setSessionError(null)
      return
    }

    let active = true
    let retryTimer: number | null = null
    const deadline = getStartupDeadline()

    const scheduleStartupRetry = () => {
      if (reloadCount !== 0 || !deadline || Date.now() + redroidViewerRefreshIntervalMs >= deadline.getTime()) {
        return false
      }
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        if (document.visibilityState === 'visible') retryWhenVisible()
        else document.addEventListener('visibilitychange', retryWhenVisible)
      }, redroidViewerRefreshIntervalMs)
      return true
    }

    const retryWhenVisible = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', retryWhenVisible)
      if (deadline && Date.now() < deadline.getTime()) {
        void loadSession()
      } else {
        setSessionError('The display service could not create a viewer session.')
      }
    }

    const loadSession = async () => {
      const requestAt = performance.timeOrigin + performance.now()
      try {
        const result = await getScrcpySessionAction(app.id)
        if (!active) {
          return
        }

        if (!result.ok) {
          const retrying = result.error.code === 'upstream_unavailable' && scheduleStartupRetry()
          setSessionError(retrying ? null : result.error.message)
          return
        }

        const nextSession = result.data
        setSessionRecord({ runtime, requestAt, value: nextSession })
        setSurfaceRefreshVersion(current => current + 1)
        const canRetry =
          nextSession.viewerServiceConfigured &&
          nextSession.viewerError?.code !== 'adb_missing' &&
          nextSession.viewerError?.retryable !== false
        const ready = nextSession.displaySession?.viewerPath
        setSessionError(
          ready || (canRetry && scheduleStartupRetry())
            ? null
            : 'The display service could not create a viewer session.'
        )
      } catch (error) {
        if (!active) {
          return
        }

        setSessionError(getToastErrorDescription(error))
      }
    }

    void loadSession()

    return () => {
      active = false
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer)
      }
      document.removeEventListener('visibilitychange', retryWhenVisible)
    }
  }, [app.id, app.status, runtime, reloadCount])

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

  if (
    sessionError ||
    !session?.viewerServiceConfigured ||
    !session.displaySession?.viewerPath ||
    surfaces.length === 0
  ) {
    let error: { description: string; detail?: string } | undefined
    if (session && !session.viewerServiceConfigured) {
      error = { description: 'The live display service is not ready.' }
    } else if (sessionError) {
      error = { description: 'The live display session could not be opened.', detail: sessionError }
    }

    return (
      <EmbeddedViewerFallback
        app={app}
        loadingDescription={session ? 'Preparing the display session.' : 'Rebroid is opening the app screen.'}
        streamingSettings={streamingSettings}
        error={error}
        onRetry={() => {
          setSessionRecord(null)
          setSessionError(null)
          reloadSession()
        }}
      />
    )
  }

  return (
    <div className='relative h-[var(--app-viewer-height)] min-h-0 w-full overflow-hidden'>
      <ViewerActivityKeepalive applicationId={session.applicationId} />
      <Visible when={!session.viewerTargetConnected}>
        <div className='pointer-events-none absolute left-3 right-3 top-10 z-20 rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning backdrop-blur-md'>
          Viewer connection could not be confirmed yet.
        </div>
      </Visible>
      <DisplayViewerProvider
        key={runtime}
        value={{
          applicationId: session.applicationId,
          surfaces,
          surfaceRefreshVersion,
          initialKeyboardCaptureEnabled: viewerSettings.keyboardCaptureEnabled,
          controlsEnabled: true,
          canControl: canControlViewer && session.displaySession.capabilities.includes('control'),
          canCaptureScreenshot: canCaptureScreenshot && session.displaySession.capabilities.includes('screenshot'),
          onSurfacesChanged: reloadSession,
          onKeyboardCaptureChange: enabled => {
            onViewerSettingsChange?.({
              ...viewerSettings,
              keyboardCaptureEnabled: enabled
            })
          },
          onStreamMetrics,
          onFirstFrame: observation => {
            if (!currentSession || (observation && observation.connectAt < currentSession.requestAt)) return
            onFirstFrame?.(observation, currentSession.requestAt)
          }
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
