'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/android-application-core/redroid-runtime'
import { IconLoader2, IconPictureInPicture } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { ViewerActionBar } from '@/features/applications/viewer/components/viewer-action-bar'
import { DisplayViewerProvider } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { DisplayViewerShell } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-shell'
import { IconActionButton } from '@/features/applications/viewer/display/display-viewer-shell/surface/icon-action-button'
import {
  getViewerStartupDeadline,
  redroidViewerRefreshIntervalMs
} from '@/features/applications/viewer/display/display-viewer-startup'
import {
  buildDisplayViewerSurfaces,
  type DisplayViewerSurface
} from '@/features/applications/viewer/display/display-viewer-surfaces'
import { usePinnedViewer } from '@/features/applications/viewer/mini-player/pinned-viewer-context'
import {
  getViewerFrameClassName,
  getViewerFrameLayout,
  getViewerFrameStyle
} from '@/features/applications/viewer/player/android-viewer-layout'
import { ViewerPlaceholderScreen } from '@/features/applications/viewer/player/viewer-placeholder-screen'
import { getScrcpySessionAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import { appResourceHref } from '@/shared/model/applications/app-resource-links'
import { StateView, type StateViewAction } from '@/shared/ui/state-view'
import { ViewerActivityKeepalive } from './viewer-activity-keepalive'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type {
  DisplayViewerStreamMetrics,
  DisplayViewerStreamStatus,
  ViewerFrameObservation
} from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { ViewerOrientation } from '@/features/applications/viewer/player/android-viewer'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { ScrcpySession } from '@/shared/contracts/application'

type EmbeddedViewerError = {
  description: string
  requestId?: string
  recovery: 'retry' | 'app' | 'apps'
}

const sessionUnavailable: EmbeddedViewerError = {
  description: 'Rebroid could not start a display session.',
  recovery: 'retry'
}

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
  error?: EmbeddedViewerError
  onRetry: () => void
}) => {
  const layout = getViewerFrameLayout(app, viewerOrientation(app))
  let action: StateViewAction = { label: 'Try again', onClick: onRetry }
  if (error?.recovery === 'app') action = { label: 'Open app', href: appResourceHref(app.id) }
  if (error?.recovery === 'apps') action = { label: 'Back to apps', href: '/apps' }

  return (
    <div className='flex w-full items-center justify-center'>
      <div
        data-viewer-frame
        role='region'
        aria-label='Android display'
        className={getViewerFrameClassName(false)}
        style={getViewerFrameStyle(layout, false)}
      >
        <div className='flex min-h-0 w-full flex-1 flex-col overflow-auto rounded-overlay bg-surface-panel'>
          {error ? (
            <StateView
              kind='error'
              scope='grid'
              title='Viewer unavailable'
              description={error.description}
              requestId={error.requestId}
              actions={[action]}
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
        {streamingSettings ? <ViewerActionBar>{streamingSettings}</ViewerActionBar> : null}
      </div>
    </div>
  )
}

export const DisplayViewerEmbed = ({
  app,
  viewerSettings,
  viewerSettingsHydrated = true,
  canControlViewer,
  canCaptureScreenshot,
  onViewerSettingsChange,
  onStreamMetrics,
  onStreamIssue,
  onFirstFrame,
  streamingSettings,
  clipboard
}: {
  app: AppDefinition
  viewerSettings: ViewerSettings
  viewerSettingsHydrated?: boolean
  canControlViewer: boolean
  canCaptureScreenshot: boolean
  onViewerSettingsChange?: (settings: ViewerSettings) => void
  streamingSettings?: ReactNode
  clipboard?: ReactNode
  onStreamMetrics?: (surface: DisplayViewerSurface, metrics: DisplayViewerStreamMetrics) => void
  onStreamIssue?: (surfaceId: string, status: DisplayViewerStreamStatus) => void
  onFirstFrame?: (observation?: ViewerFrameObservation, requestAt?: number) => void
}) => {
  const pinnedViewer = usePinnedViewer()
  const mainDisplayPinned = pinnedViewer?.isDesktop === true && pinnedViewer.pinnedAppId === app.id
  const startedAt = app.lastStartedAt?.getTime() ?? null
  const runtime = `${app.id}:${app.containerId}:${startedAt}`
  const [restoredSession] = useState(() => pinnedViewer?.getSession(app.id, runtime))
  const baseUrl = useBrowserBaseUrl()
  const [sessionRecord, setSessionRecord] = useState<{
    runtime: string
    requestAt: number
    value: ScrcpySession
  } | null>(restoredSession ?? null)
  const [failure, setFailure] = useState<{ runtime: string; error: EmbeddedViewerError } | null>(null)
  const sessionError = failure?.runtime === runtime ? failure.error : null
  const [surfaceRefreshVersion, setSurfaceRefreshVersion] = useState(0)
  const [reload, setReload] = useState({ runtime: '', count: 0 })
  const currentSession = sessionRecord?.runtime === runtime ? sessionRecord : null
  const session = currentSession?.value
  const reloadCount = reload.runtime === runtime ? reload.count : 0
  const reloadSession = () =>
    setReload(current => ({ runtime, count: current.runtime === runtime ? current.count + 1 : 1 }))
  const getStartupDeadline = useEffectEvent(() =>
    getViewerStartupDeadline(startedAt, app.provisioningCompletedAt?.getTime() ?? null)
  )
  const dockedSession = useMemo(
    () => (currentSession ? { name: app.name, runtime, session: currentSession } : undefined),
    [app.name, currentSession, runtime]
  )

  useEffect(() => {
    const setSessionError = (error: EmbeddedViewerError | null) => setFailure(error ? { runtime, error } : null)
    if (app.status !== 'running') {
      setSessionRecord(null)
      setSessionError(null)
      return
    }
    if (reloadCount === 0 && runtime === restoredSession?.runtime) return

    let active = true
    let retryTimer: number | null = null
    const deadline = getStartupDeadline()
    const startWhenVisible = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', startWhenVisible)
      void loadSession()
    }

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
        setSessionError(sessionUnavailable)
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
          const requestId = result.requestId === 'local' ? undefined : result.requestId
          const code = result.error.code
          if (retrying) setSessionError(null)
          else if (code === 'forbidden' || code === 'not_found' || code === 'unauthenticated') {
            setSessionError({
              description: 'This display could not be opened with your account.',
              recovery: 'apps',
              requestId
            })
          } else if (code === 'conflict') {
            setSessionError({
              description: 'The app is not ready for viewing. Check its current status.',
              recovery: 'app',
              requestId
            })
          } else {
            setSessionError({ ...sessionUnavailable, requestId })
          }
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
        setSessionError(ready || (canRetry && scheduleStartupRetry()) ? null : sessionUnavailable)
      } catch {
        if (!active) {
          return
        }

        setSessionError(sessionUnavailable)
      }
    }

    if (document.visibilityState === 'visible') startWhenVisible()
    else document.addEventListener('visibilitychange', startWhenVisible)

    return () => {
      active = false
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer)
      }
      document.removeEventListener('visibilitychange', retryWhenVisible)
      document.removeEventListener('visibilitychange', startWhenVisible)
    }
  }, [app.id, app.status, runtime, reloadCount, restoredSession])

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
    !viewerSettingsHydrated ||
    sessionError ||
    !session?.viewerServiceConfigured ||
    !session.displaySession?.viewerPath ||
    surfaces.length === 0
  ) {
    let error = sessionError ?? undefined
    if (session && !session.viewerServiceConfigured) {
      error = { description: 'The live display service is not ready.', recovery: 'retry' }
    } else if (session?.viewerError?.code === 'adb_missing') {
      error = { description: 'This app image does not support live display access.', recovery: 'app' }
    }

    return (
      <EmbeddedViewerFallback
        app={app}
        loadingDescription={session ? 'Preparing the display session.' : 'Rebroid is opening the app screen.'}
        streamingSettings={streamingSettings}
        error={error}
        onRetry={() => {
          setSessionRecord(null)
          setFailure(null)
          reloadSession()
        }}
      />
    )
  }

  const canControl = canControlViewer && session.displaySession.capabilities.includes('control')
  const pinButton =
    pinnedViewer?.isDesktop && !mainDisplayPinned && surfaces.some(surface => surface.kind === 'main') ? (
      <IconActionButton
        label='Minimize player'
        keyShortcut='i'
        onClick={() => pinnedViewer.minimize(app.id)}
      >
        <IconPictureInPicture className='size-3.5' />
      </IconActionButton>
    ) : null

  return (
    <div className='relative flex h-[var(--app-viewer-height)] min-h-0 w-full flex-col overflow-hidden'>
      {!mainDisplayPinned && <ViewerActivityKeepalive applicationId={session.applicationId} />}
      <Visible when={!session.viewerTargetConnected}>
        <div className='pointer-events-none absolute left-3 right-3 top-10 z-20 rounded-control border border-warning/(--feedback-border-opacity) bg-warning/10 px-3 py-2 text-xs text-warning backdrop-blur-md'>
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
          canControl,
          dockedSession,
          canClipboard: Boolean(clipboard) && session.displaySession.capabilities.includes('clipboard'),
          canCaptureScreenshot: canCaptureScreenshot && session.displaySession.capabilities.includes('screenshot'),
          onSurfacesChanged: reloadSession,
          onKeyboardCaptureChange: enabled => {
            onViewerSettingsChange?.({
              ...viewerSettings,
              keyboardCaptureEnabled: enabled
            })
          },
          onStreamMetrics: onStreamMetrics
            ? (surfaceId, metrics) => {
                const surface = surfaces.find(item => item.id === surfaceId)
                if (surface) onStreamMetrics(surface, metrics)
              }
            : undefined,
          onStreamIssue,
          onFirstFrame: observation => {
            if (!currentSession || (observation && observation.connectAt < currentSession.requestAt)) return
            onFirstFrame?.(observation, currentSession.requestAt)
          }
        }}
      >
        <DisplayViewerShell
          className='min-h-0 w-full flex-1 !bg-transparent'
          streamingSettings={
            <>
              {streamingSettings}
              {pinButton}
            </>
          }
          clipboard={clipboard}
          miniPlayerEnabled={!pinnedViewer}
        />
      </DisplayViewerProvider>
    </div>
  )
}
