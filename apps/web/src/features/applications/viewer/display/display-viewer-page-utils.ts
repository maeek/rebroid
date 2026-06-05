import { headers } from 'next/headers'
import {
  defaultViewerSettings,
  isViewerPlayer,
  normalizeViewerSettings
} from '@/features/applications/viewer/settings/viewer-settings'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { ScrcpySession } from '@/server/orchestrator/applications/types'

export const redroidViewerStartupGracePeriodMs = 45_000
export const redroidViewerRefreshIntervalMs = 3_000
export const viewerUnavailableDetail = 'Refresh the viewer or restart the app, then try again.'

export type ViewerErrorDetails = {
  code: 'sidecar_unavailable' | 'adb_missing' | 'adb_unreachable' | 'unknown'
  message: string
  retryable: boolean
  exitCode: number | null
  command: string[] | null
  stdout: string | null
  stderr: string | null
} | null

export type ViewerSearchParams = {
  keyboard?: string
  sound?: string
  player?: string
  transport?: string
  bitrateMbps?: string
  maxFps?: string
  maxSize?: string
  iFrameInterval?: string
  fitToFrame?: string
  controls?: string
  surfaceId?: string
}

export const getBaseUrl = async () => {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3000'
  const protocol = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'
  return `${protocol}://${host}`
}

const getDisplaySidecarInternalBaseUrl = () =>
  (process.env.DISPLAY_SIDECAR_INTERNAL_BASE_URL || 'http://rebroid-display-sidecar:8000').replace(/\/$/, '')

export const checkDisplaySidecarTarget = async () => {
  try {
    const response = await fetch(`${getDisplaySidecarInternalBaseUrl()}/rebroid/display/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2_000)
    })

    return response.ok || response.status < 500
  } catch {
    return false
  }
}

export const isLikelyRedroidImage = (containerImage: string) => containerImage.toLowerCase().includes('redroid')

const numberParam = (value: string | undefined, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const viewerSettingsFromSearchParams = (searchParams: ViewerSearchParams | undefined): ViewerSettings =>
  normalizeViewerSettings({
    keyboardCaptureEnabled: searchParams?.keyboard === '1',
    soundEnabled: searchParams?.sound !== '0',
    player: isViewerPlayer(searchParams?.player) ? searchParams.player : undefined,
    transport: searchParams?.transport === 'websocket' ? 'websocket' : 'webrtc',
    bitrateMbps: numberParam(searchParams?.bitrateMbps, defaultViewerSettings.bitrateMbps),
    maxFps: numberParam(searchParams?.maxFps, defaultViewerSettings.maxFps),
    maxSize: numberParam(searchParams?.maxSize, defaultViewerSettings.maxSize),
    iFrameInterval: numberParam(searchParams?.iFrameInterval, defaultViewerSettings.iFrameInterval),
    fitToFrame: searchParams?.fitToFrame === '1'
  })

export const getViewerError = (session: ScrcpySession): ViewerErrorDetails => {
  const candidate = Reflect.get(session, 'viewerError')
  if (!candidate || typeof candidate !== 'object') return null

  const record = candidate as Record<string, unknown>
  const code = Reflect.get(record, 'code')
  const message = Reflect.get(record, 'message')
  const retryable = Reflect.get(record, 'retryable')
  const exitCode = Reflect.get(record, 'exitCode')
  const command = Reflect.get(record, 'command')
  const stdout = Reflect.get(record, 'stdout')
  const stderr = Reflect.get(record, 'stderr')
  const isKnownCode =
    code === 'sidecar_unavailable' || code === 'adb_missing' || code === 'adb_unreachable' || code === 'unknown'

  if (!isKnownCode || typeof message !== 'string' || typeof retryable !== 'boolean') return null

  return {
    code,
    message,
    retryable,
    exitCode: typeof exitCode === 'number' ? exitCode : null,
    command: Array.isArray(command) && command.every(value => typeof value === 'string') ? command : null,
    stdout: typeof stdout === 'string' ? stdout : null,
    stderr: typeof stderr === 'string' ? stderr : null
  }
}

const isTransientViewerStartupIssue = (viewerError: ViewerErrorDetails) => {
  if (!viewerError) return true
  return viewerError.retryable
}

export const getViewerStartupDeadline = (lastStartedAt: string | null) => {
  if (!lastStartedAt) return null

  const startedAtMs = Date.parse(lastStartedAt)
  if (Number.isNaN(startedAtMs)) return null

  return new Date(startedAtMs + redroidViewerStartupGracePeriodMs)
}

export const describeViewerIssue = ({
  viewerError,
  message,
  containerImage,
  lastStartedAt
}: {
  viewerError: ViewerErrorDetails
  message: string | null
  containerImage: string
  lastStartedAt: string | null
}) => {
  if (!message) {
    const startupDeadline = getViewerStartupDeadline(lastStartedAt)
    if (startupDeadline && isLikelyRedroidImage(containerImage) && Date.now() < startupDeadline.getTime()) {
      const secondsRemaining = Math.max(1, Math.ceil((startupDeadline.getTime() - Date.now()) / 1000))
      return {
        kind: 'pending' as const,
        title: 'Starting Android viewer',
        description: 'The app is running, but the Android display is still getting ready.',
        detail: `Retrying automatically for up to ${secondsRemaining} more seconds.`,
        deadlineAt: startupDeadline.toISOString()
      }
    }
    return null
  }

  const compactMessage = message.replace(/\s+/g, ' ').trim()
  const startupDeadline = getViewerStartupDeadline(lastStartedAt)

  if (viewerError?.code === 'adb_missing') {
    return {
      kind: 'fatal' as const,
      title: 'Viewer not supported for this app',
      description: 'This app image does not expose the Android tools needed for live screen streaming.',
      detail: 'Use an Android image that supports live display access.'
    }
  }

  if (
    startupDeadline &&
    isLikelyRedroidImage(containerImage) &&
    Date.now() < startupDeadline.getTime() &&
    isTransientViewerStartupIssue(viewerError)
  ) {
    const secondsRemaining = Math.max(1, Math.ceil((startupDeadline.getTime() - Date.now()) / 1000))
    return {
      kind: 'pending' as const,
      title: 'Starting Android viewer',
      description: 'The app has started, but the Android display is not ready just yet.',
      detail:
        `Retrying every ${Math.round(redroidViewerRefreshIntervalMs / 1000)} seconds ` +
        `for up to ${secondsRemaining} more seconds.`,
      deadlineAt: startupDeadline.toISOString()
    }
  }

  if (viewerError?.code === 'adb_unreachable') {
    return {
      kind: 'fatal' as const,
      title: 'Viewer could not reach the app',
      description: 'The live Android display could not connect to this app.',
      detail: viewerUnavailableDetail
    }
  }

  return {
    kind: 'warning' as const,
    banner: compactMessage ? 'Viewer connection could not be confirmed yet.' : 'Viewer connection is still starting.'
  }
}
