const trimTrailingSlash = (value: string) => value.replace(/\/$/, '')

const getBrowserOrigin = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.location.origin
}

export const getScrcpyBaseUrl = () => {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_SCRCPY_BASE_URL?.trim()
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl)
  }

  const browserOrigin = getBrowserOrigin()
  return browserOrigin ? trimTrailingSlash(browserOrigin) : null
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

export const getScrcpyViewerUrl = ({
  applicationId,
  adbPort,
  baseUrl = getScrcpyBaseUrl()
}: {
  applicationId: string
  adbPort: number
  baseUrl?: string | null
}) => {
  if (!baseUrl) {
    return null
  }

  const websocketBaseUrl = toWebSocketBaseUrl(baseUrl)
  const remoteTarget = encodeURIComponent(`tcp:${adbPort}`)
  const udid = encodeURIComponent(applicationId)
  const proxyUrl = `${websocketBaseUrl}/?action=proxy-adb&remote=${remoteTarget}&udid=${udid}`

  return `${baseUrl}/#!action=stream&udid=${udid}&player=mse&ws=${encodeURIComponent(proxyUrl)}`
}
