'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/application-core/redroid-runtime'
import { IconAlertTriangle, IconDeviceDesktop, IconLoader2 } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { DisplayViewerProvider } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { DisplayViewerShell } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-shell'
import { buildDisplayViewerSurfaces } from '@/features/applications/viewer/display/display-viewer-surfaces'
import {
  getViewerFrameClassName,
  getViewerFrameLayout,
  getViewerFrameStyle
} from '@/features/applications/viewer/player/android-viewer-layout'
import { ViewerPlaceholderScreen } from '@/features/applications/viewer/player/viewer-placeholder-screen'
import { getToastErrorDescription } from '@/features/applications/viewer/utils/viewer-error-utils'
import { getScrcpySessionAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import { StatusSplash } from '@/shared/ui/status-splash'
import { ViewerActivityKeepalive } from './viewer-activity-keepalive'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerOrientation } from '@/features/applications/viewer/player/android-viewer'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { ScrcpySession } from '@/server/orchestrator/applications/types'

const sessionRetryIntervalMs = 3_000

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
    <StatusSplash
      title={title}
      description={description}
      detail={detail}
      tone={tone}
      icon={
        icon ??
        (tone === 'danger' ? <IconAlertTriangle className='size-10' /> : <IconDeviceDesktop className='size-10' />)
      }
      className='min-h-0'
    />
  </div>
)

const viewerOrientation = (app: AppDefinition): ViewerOrientation => {
  const display = getRedroidDisplayDimensionsFromArgs(app.containerArgs)
  return display.width >= display.height ? 'landscape' : 'portrait'
}

const DisplayLoadingSurface = ({ app, description }: { app: AppDefinition; description: string }) => {
  const layout = getViewerFrameLayout(app, viewerOrientation(app))

  return (
    <div className='flex min-h-136 w-full items-center justify-center p-4 sm:p-6'>
      <div
        className={getViewerFrameClassName(false)}
        style={getViewerFrameStyle(layout, false)}
      >
        <ViewerPlaceholderScreen
          app={app}
          placeholder={{
            title: 'Starting live display',
            description,
            toneClassName: 'text-primary',
            Icon: IconLoader2,
            showSpinner: true,
            showProgress: false
          }}
        />
      </div>
    </div>
  )
}

export const DisplayViewerEmbed = ({
  app,
  viewerSettings,
  canControlViewer,
  canCaptureScreenshot,
  onViewerSettingsChange
}: {
  app: AppDefinition
  viewerSettings: ViewerSettings
  canControlViewer: boolean
  canCaptureScreenshot: boolean
  onViewerSettingsChange?: (settings: ViewerSettings) => void
}) => {
  const baseUrl = useBrowserBaseUrl()
  const [session, setSession] = useState<ScrcpySession | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (app.status !== 'running') {
      setSession(null)
      setSessionError(null)
      return
    }

    let active = true
    let retryTimer: number | null = null

    const loadSession = async () => {
      try {
        const nextSession = await getScrcpySessionAction(app.id)
        if (!active) {
          return
        }

        setSession(nextSession)
        setSessionError(null)

        if (!nextSession.displaySession?.viewerPath) {
          retryTimer = window.setTimeout(() => void loadSession(), sessionRetryIntervalMs)
        }
      } catch (error) {
        if (!active) {
          return
        }

        setSessionError(getToastErrorDescription(error))
        retryTimer = window.setTimeout(() => void loadSession(), sessionRetryIntervalMs)
      }
    }

    void loadSession()

    return () => {
      active = false
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer)
      }
    }
  }, [app.id, app.status, reloadToken])

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

  if (sessionError && !session) {
    return (
      <EmbeddedViewerSplash
        title='Viewer unavailable'
        description='The live display session could not be opened.'
        detail={sessionError}
        tone='danger'
      />
    )
  }

  if (!session) {
    return (
      <DisplayLoadingSurface
        app={app}
        description='Rebroid is opening the app screen.'
      />
    )
  }

  if (!session.viewerServiceConfigured) {
    return (
      <EmbeddedViewerSplash
        title='Viewer unavailable'
        description='The live display service is not ready.'
        detail='Refresh the viewer or restart the app, then try again.'
        tone='danger'
      />
    )
  }

  if (!session.displaySession?.viewerPath || surfaces.length === 0) {
    return (
      <DisplayLoadingSurface
        app={app}
        description='Preparing the display session.'
      />
    )
  }

  return (
    <div className='relative h-[min(70dvh,58rem)] min-h-104 w-full overflow-hidden sm:h-[min(78dvh,58rem)] sm:min-h-136'>
      <ViewerActivityKeepalive applicationId={session.applicationId} />
      <Visible when={!session.viewerTargetConnected}>
        <div className='absolute left-3 right-3 top-3 z-20 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning backdrop-blur-md'>
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
          onSurfacesChanged: () => setReloadToken(current => current + 1),
          onKeyboardCaptureChange: enabled => {
            onViewerSettingsChange?.({
              ...viewerSettings,
              keyboardCaptureEnabled: enabled
            })
          }
        }}
      >
        <DisplayViewerShell className='h-full w-full !bg-transparent' />
      </DisplayViewerProvider>
    </div>
  )
}
