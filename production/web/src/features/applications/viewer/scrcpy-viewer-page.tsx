import type { ReactNode } from 'react'
import { IconAlertTriangle, IconCast, IconLoader2 } from '@tabler/icons-react'
import { headers } from 'next/headers'
import { Visible } from '@/components/ui/visible'
import { ScrcpyViewerFrame } from '@/features/applications/viewer/scrcpy-viewer-frame'
import { getProtectedWsScrcpyUrl } from '@/features/applications/viewer/scrcpy-url'
import {
  defaultViewerSettings,
  isViewerPlayer,
  normalizeViewerSettings
} from '@/features/applications/viewer/viewer-settings'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { getApplicationAction, getScrcpySessionAction } from '@/server/orchestrator/applications/read-actions'
import { createScrcpyViewerToken } from '@/server/viewer/viewer-token'
import { getDisplayErrorMessage } from '../../../lib/error-utils'
import { ViewerActivityKeepalive, ViewerStartupRefresh } from './viewer-activity-keepalive'
import type { ViewerSettings } from '@/features/applications/viewer/viewer-settings'
import type { AndroidApplication, ScrcpySession } from '@/server/orchestrator/applications/types'

const redroidViewerStartupGracePeriodMs = 45_000
const redroidViewerRefreshIntervalMs = 3_000

type ViewerErrorDetails = {
  code: 'sidecar_unavailable' | 'adb_missing' | 'adb_unreachable' | 'unknown'
  message: string
  retryable: boolean
  exitCode: number | null
  command: string[] | null
  stdout: string | null
  stderr: string | null
} | null

type ViewerSearchParams = {
  keyboard?: string
  sound?: string
  player?: string
  bitrateMbps?: string
  maxFps?: string
  maxSize?: string
  iFrameInterval?: string
  fitToFrame?: string
}

const getBaseUrl = async () => {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3000'
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  return `${protocol}://${host}`
}

const getWsScrcpyInternalBaseUrl = () =>
  (process.env.WS_SCRCPY_INTERNAL_BASE_URL || 'http://rebroid-ws-scrcpy:8000').replace(/\/$/, '')

const checkWsScrcpyProxyTarget = async () => {
  try {
    const response = await fetch(`${getWsScrcpyInternalBaseUrl()}/viewer/ws-scrcpy/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2_000)
    })

    return response.ok || response.status < 500
  } catch {
    return false
  }
}

const ViewerSplash = ({
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
  <main className='flex min-h-screen items-center justify-center bg-background p-6'>
    <StatusSplash
      title={title}
      description={description}
      detail={detail}
      tone={tone}
      icon={icon ?? (tone === 'danger' ? <IconAlertTriangle className='size-10' /> : <IconCast className='size-10' />)}
      className='min-h-[70vh] w-full'
    />
  </main>
)

const isLikelyRedroidImage = (containerImage: string) => containerImage.toLowerCase().includes('redroid')

const numberParam = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const viewerSettingsFromSearchParams = (searchParams: ViewerSearchParams | undefined): ViewerSettings =>
  normalizeViewerSettings({
    keyboardCaptureEnabled: searchParams?.keyboard === '1',
    soundEnabled: searchParams?.sound !== '0',
    player: isViewerPlayer(searchParams?.player) ? searchParams.player : undefined,
    bitrateMbps: numberParam(searchParams?.bitrateMbps, defaultViewerSettings.bitrateMbps),
    maxFps: numberParam(searchParams?.maxFps, defaultViewerSettings.maxFps),
    maxSize: numberParam(searchParams?.maxSize, defaultViewerSettings.maxSize),
    iFrameInterval: numberParam(searchParams?.iFrameInterval, defaultViewerSettings.iFrameInterval),
    fitToFrame: searchParams?.fitToFrame === '1'
  })

const wsScrcpyStoragePrefixes = (player: string) => {
  const normalizedPlayer = player.toLowerCase()
  if (normalizedPlayer.includes('webcodecs')) {
    return ['WebCodecsPlayer']
  }
  if (normalizedPlayer.includes('broadway')) {
    return ['BroadwayDecoder']
  }
  if (normalizedPlayer.includes('tinyh264')) {
    return ['Tinyh264Decoder']
  }

  return ['MseDecoder']
}

const createWsScrcpySettingsScript = (session: ScrcpySession, viewerSettings: ViewerSettings) => {
  const videoSettings = {
    bitrate: viewerSettings.bitrateMbps * 1_000_000,
    maxFps: viewerSettings.maxFps,
    iFrameInterval: viewerSettings.iFrameInterval,
    lockedVideoOrientation: -1,
    bounds:
      viewerSettings.maxSize > 0
        ? {
            width: viewerSettings.maxSize,
            height: viewerSettings.maxSize
          }
        : undefined,
    sendFrameMeta: false,
    displayId: 0
  }
  const prefixes = wsScrcpyStoragePrefixes(viewerSettings.player)

  return `
(() => {
  const udid = ${JSON.stringify(session.udid)};
  const prefixes = ${JSON.stringify(prefixes)};
  const videoSettings = ${JSON.stringify(videoSettings)};
  const fitToFrame = ${JSON.stringify(viewerSettings.fitToFrame)};
  const viewportKey = window.innerWidth + 'x' + window.innerHeight;
  for (const prefix of prefixes) {
    const key = prefix + ':' + udid + ':' + viewportKey;
    window.localStorage.setItem(key, JSON.stringify(videoSettings));
    window.localStorage.setItem(key + ':fit', JSON.stringify(fitToFrame));
  }
})();`
}

const getViewerError = (session: ScrcpySession): ViewerErrorDetails => {
  const candidate = Reflect.get(session as unknown as Record<string, unknown>, 'viewerError')
  if (!candidate || typeof candidate !== 'object') {
    return null
  }

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

  if (!isKnownCode || typeof message !== 'string' || typeof retryable !== 'boolean') {
    return null
  }

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
  if (!viewerError) {
    return true
  }

  return viewerError.retryable
}

const getViewerStartupDeadline = (lastStartedAt: string | null) => {
  if (!lastStartedAt) {
    return null
  }

  const startedAtMs = Date.parse(lastStartedAt)
  if (Number.isNaN(startedAtMs)) {
    return null
  }

  return new Date(startedAtMs + redroidViewerStartupGracePeriodMs)
}

const describeViewerIssue = ({
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
        description: 'The redroid container is running, but ADB is still coming online for scrcpy.',
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
      detail: ''
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
      description: 'The redroid container has started, but ADB is not ready for scrcpy just yet.',
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
      description: 'ws-scrcpy could not find a reachable Android ADB endpoint inside this container.',
      detail:
        'Make sure the image starts an Android environment with ADB listening on port 5555 before opening the viewer.'
    }
  }

  return {
    kind: 'warning' as const,
    banner: `Viewer connection could not be confirmed: ${compactMessage}`
  }
}

export async function ScrcpyViewerPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<ViewerSearchParams>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const viewerSettings = viewerSettingsFromSearchParams(resolvedSearchParams)

  let app: AndroidApplication
  let session: ScrcpySession
  try {
    ;[app, session] = await Promise.all([getApplicationAction(id), getScrcpySessionAction(id)])
  } catch (error) {
    return (
      <ViewerSplash
        title='Viewer unavailable'
        description='The app must be running before a scrcpy stream can be opened.'
        detail={getDisplayErrorMessage(error)}
        tone='danger'
      />
    )
  }

  if (!session.viewerServiceConfigured) {
    return (
      <ViewerSplash
        title='Viewer sidecar not connected'
        description='The orchestrator is running, but the shared ws-scrcpy service is not configured.'
        detail='Build the ws-scrcpy sidecar image or check the orchestrator scrcpy health status.'
      />
    )
  }

  const viewerIssue = !session.viewerTargetConnected
    ? describeViewerIssue({
        viewerError: getViewerError(session),
        message: session.viewerMessage,
        containerImage: app.runtime.image,
        lastStartedAt: app.status.lastStartedAt
      })
    : null

  if (!session.viewerTargetConnected && viewerIssue?.kind === 'pending') {
    return (
      <>
        <ViewerStartupRefresh
          deadlineAt={viewerIssue.deadlineAt}
          intervalMs={redroidViewerRefreshIntervalMs}
        />
        <ViewerSplash
          title={viewerIssue.title}
          description={viewerIssue.description}
          detail={viewerIssue.detail}
          icon={<IconLoader2 className='size-10 animate-spin' />}
        />
      </>
    )
  }

  if (!session.viewerTargetConnected && viewerIssue?.kind === 'fatal') {
    return (
      <ViewerSplash
        title={viewerIssue.title}
        description={viewerIssue.description}
        detail={viewerIssue.detail}
        tone='danger'
      />
    )
  }

  if (!(await checkWsScrcpyProxyTarget())) {
    return (
      <ViewerSplash
        title='Viewer transport unavailable'
        description='The app is running, but the web server cannot reach ws-scrcpy.'
        detail='When using the orchestrator internal Docker daemon, the sidecar must be published back to the web container or the deployment must use the host container-engine socket.'
        tone='danger'
      />
    )
  }

  const viewerToken = await createScrcpyViewerToken({
    appId: session.applicationId,
    udid: session.udid
  })
  const viewerUrl = getProtectedWsScrcpyUrl({
    session,
    baseUrl: await getBaseUrl(),
    viewerToken,
    soundEnabled: viewerSettings.soundEnabled,
    settings: viewerSettings
  })

  return (
    <main className='relative min-h-screen overflow-hidden bg-background'>
      <ViewerActivityKeepalive applicationId={session.applicationId} />
      <Visible when={!session.viewerTargetConnected}>
        <div className='absolute left-3 right-3 top-3 z-10 rounded-md border border-destructive/35 bg-destructive/20 px-3 py-2 text-xs text-foreground backdrop-blur-md'>
          {viewerIssue?.kind === 'warning'
            ? viewerIssue.banner
            : `ws-scrcpy could not confirm ADB connection: ${session.viewerMessage ?? 'unknown error'}`}
        </div>
      </Visible>
      <script dangerouslySetInnerHTML={{ __html: createWsScrcpySettingsScript(session, viewerSettings) }} />
      <ScrcpyViewerFrame
        src={viewerUrl}
        keyboardCaptureEnabled={viewerSettings.keyboardCaptureEnabled}
      />
      <div className='pointer-events-none absolute inset-0 hidden items-center justify-center bg-background/80 text-secondary-foreground'>
        <IconLoader2 className='size-8 animate-spin' />
      </div>
    </main>
  )
}
