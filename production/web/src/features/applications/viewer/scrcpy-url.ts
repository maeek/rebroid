import type { ViewerSettings } from './viewer-settings'
import type { ScrcpySession } from '@/server/orchestrator/applications/types'

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '')

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

  return `/viewer/apps/${applicationId}${query.size > 0 ? `?${query.toString()}` : ''}`
}

const toWebSocketBaseUrl = (baseUrl: string) => {
  if (baseUrl.startsWith('https://')) {
    return `wss://${baseUrl.slice('https://'.length)}`
  }

  if (baseUrl.startsWith('http://')) {
    return `ws://${baseUrl.slice('http://'.length)}`
  }

  return baseUrl
}

export const getProtectedWsScrcpyUrl = ({
  session,
  baseUrl,
  viewerToken,
  soundEnabled,
  settings
}: {
  session: ScrcpySession
  baseUrl: string
  viewerToken: string
  soundEnabled?: boolean
  settings?: Pick<ViewerSettings, 'fitToFrame'>
}) => {
  const publicBaseUrl = trimTrailingSlash(baseUrl)
  const proxyPath = '/viewer/ws-scrcpy/'
  const websocketBaseUrl = toWebSocketBaseUrl(publicBaseUrl)
  const proxyQuery = new URLSearchParams({
    action: 'proxy-adb',
    appId: session.applicationId,
    remote: session.proxyRemote,
    udid: session.udid,
    sma_viewer_token: viewerToken
  })
  const proxyUrl = `${websocketBaseUrl}${proxyPath}?${proxyQuery.toString()}`
  const viewerQuery = new URLSearchParams({ sma_viewer_token: viewerToken })
  const hashQuery = new URLSearchParams({
    action: 'stream',
    udid: session.udid,
    player: session.player,
    audio: soundEnabled === false ? '0' : '1',
    ws: proxyUrl
  })
  if (settings?.fitToFrame) {
    hashQuery.set('fitToScreen', '1')
  }

  return `${publicBaseUrl}${proxyPath}?${viewerQuery.toString()}#!${hashQuery.toString()}`
}
