import { defaultViewerSettings, type ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { ScrcpySession } from '@/server/orchestrator/applications/types'

export type DisplaySurfaceRef = {
  id: string
  sessionId: string
  kind: 'main' | 'virtual'
  name: string
  viewerPath: string
  newDisplay?: {
    width: number
    height: number
    dpi: number
  }
}

export type DisplaySessionWithSurfaces = NonNullable<ScrcpySession['displaySession']> & {
  surface?: DisplaySurfaceRef
  surfaces?: DisplaySurfaceRef[]
}

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '')

const toSameOriginPath = (url: URL) => `${url.pathname}${url.search}${url.hash}`

export const getProtectedViewerShellUrl = (
  applicationId: string,
  options?: Partial<ViewerSettings>,
  shell?: { controls?: boolean; surfaceId?: string }
) => {
  const query = new URLSearchParams()
  if (shell?.controls) {
    query.set('controls', '1')
  }
  if (shell?.surfaceId) {
    query.set('surfaceId', shell.surfaceId)
  }
  if (options?.soundEnabled !== undefined) {
    query.set('sound', options.soundEnabled ? '1' : '0')
  }
  if (options?.bitrateMbps !== undefined) {
    query.set('bitrateMbps', String(options.bitrateMbps))
  }
  if (options?.maxFps !== undefined) {
    query.set('maxFps', String(options.maxFps))
  }
  if (options?.maxSize !== undefined) {
    query.set('maxSize', String(options.maxSize))
  }
  if (options?.iFrameInterval !== undefined) {
    query.set('iFrameInterval', String(options.iFrameInterval))
  }
  if (options?.fitToFrame !== undefined) {
    query.set('fitToFrame', options.fitToFrame ? '1' : '0')
  }
  if (options?.player !== undefined) {
    query.set('player', options.player)
  }
  if (options?.transport !== undefined) {
    query.set('transport', options.transport)
  }

  return `/viewer/apps/${applicationId}${query.size > 0 ? `?${query.toString()}` : ''}`
}

export const getProtectedDisplaySidecarUrl = ({
  session,
  baseUrl,
  soundEnabled,
  settings
}: {
  session: ScrcpySession
  baseUrl: string
  soundEnabled?: boolean
  settings?: Pick<
    ViewerSettings,
    'bitrateMbps' | 'fitToFrame' | 'iFrameInterval' | 'maxFps' | 'maxSize' | 'player' | 'transport'
  >
}) => {
  if (!session.displaySession?.viewerPath) {
    throw new Error('The live viewer is not ready yet.')
  }

  return getProtectedDisplaySidecarSurfaceUrl({
    surface: session.displaySession,
    player: session.player,
    baseUrl,
    soundEnabled,
    settings
  })
}

export const getProtectedDisplaySidecarSurfaceUrl = ({
  surface,
  player,
  baseUrl,
  soundEnabled,
  settings
}: {
  surface: Pick<DisplaySessionWithSurfaces, 'viewerPath'> | DisplaySurfaceRef
  player: string
  baseUrl: string
  soundEnabled?: boolean
  settings?: Pick<
    ViewerSettings,
    'bitrateMbps' | 'fitToFrame' | 'iFrameInterval' | 'maxFps' | 'maxSize' | 'player' | 'transport'
  >
}) => {
  const viewerUrl = new URL(surface.viewerPath, `${trimTrailingSlash(baseUrl)}/`)
  viewerUrl.searchParams.set('player', settings?.player ?? player)
  viewerUrl.searchParams.set('transport', settings?.transport ?? 'webrtc')
  viewerUrl.searchParams.set('audio', soundEnabled === false ? '0' : '1')
  viewerUrl.searchParams.set(
    'bitrate',
    String(Math.round((settings?.bitrateMbps ?? defaultViewerSettings.bitrateMbps) * 1_000_000))
  )
  viewerUrl.searchParams.set('maxFps', String(settings?.maxFps ?? defaultViewerSettings.maxFps))
  viewerUrl.searchParams.set('maxSize', String(settings?.maxSize ?? defaultViewerSettings.maxSize))
  viewerUrl.searchParams.set('iFrameInterval', String(settings?.iFrameInterval ?? defaultViewerSettings.iFrameInterval))
  if (settings?.fitToFrame !== undefined) {
    viewerUrl.searchParams.set('fitToFrame', settings.fitToFrame ? '1' : '0')
  }

  return toSameOriginPath(viewerUrl)
}
