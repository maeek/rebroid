import type { ScrcpySession } from './types'

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '')

export const getProtectedViewerShellUrl = (applicationId: string) => `/viewer/apps/${applicationId}`

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
  viewerToken
}: {
  session: ScrcpySession
  baseUrl: string
  viewerToken: string
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
    ws: proxyUrl
  })

  return `${publicBaseUrl}${proxyPath}?${viewerQuery.toString()}#!${hashQuery.toString()}`
}
