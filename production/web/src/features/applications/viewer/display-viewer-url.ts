import { defaultViewerSettings, type ViewerSettings } from './viewer-settings'
import type { ScrcpySession } from '@/server/orchestrator/applications/types'

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '')

const toSameOriginPath = (url: URL) => `${url.pathname}${url.search}${url.hash}`

export const getProtectedViewerShellUrl = (applicationId: string, options?: Partial<ViewerSettings>) => {
  const query = new URLSearchParams()
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
  settings?: Pick<ViewerSettings, 'bitrateMbps' | 'fitToFrame' | 'iFrameInterval' | 'maxFps' | 'maxSize' | 'player'>
}) => {
  if (!session.displaySession?.viewerPath) {
    throw new Error('The live viewer is not ready yet.')
  }

  const viewerUrl = new URL(session.displaySession.viewerPath, `${trimTrailingSlash(baseUrl)}/`)
  viewerUrl.searchParams.set('player', settings?.player ?? session.player)
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
