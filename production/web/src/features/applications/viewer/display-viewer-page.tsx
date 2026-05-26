import type { ReactNode } from 'react'
import { IconAlertTriangle, IconDeviceDesktop, IconLoader2 } from '@tabler/icons-react'
import { headers } from 'next/headers'
import { Visible } from '@/components/ui/visible'
import { DisplayViewerFrame } from '@/features/applications/viewer/display-viewer-frame'
import { getProtectedDisplaySidecarUrl } from '@/features/applications/viewer/display-viewer-url'
import {
  defaultViewerSettings,
  isViewerPlayer,
  normalizeViewerSettings
} from '@/features/applications/viewer/viewer-settings'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { getApplicationAction, getScrcpySessionAction } from '@/server/orchestrator/applications/read-actions'
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
  transport?: string
  bitrateMbps?: string
  maxFps?: string
  maxSize?: string
  iFrameInterval?: string
  fitToFrame?: string
}

const getBaseUrl = async () => {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3000'
  const protocol = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'
  return `${protocol}://${host}`
}

const getDisplaySidecarInternalBaseUrl = () =>
  (process.env.DISPLAY_SIDECAR_INTERNAL_BASE_URL || 'http://rebroid-display-sidecar:8000').replace(/\/$/, '')

const checkDisplaySidecarTarget = async () => {
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
  <main className='flex min-h-screen items-center justify-center overflow-hidden bg-black p-6'>
    <div className='relative flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-5 text-center'>
      <div className='relative h-44 w-32 rounded-[2rem] border border-border/80 bg-black shadow-2xl'>
        <div className='absolute left-1/2 top-3 h-1 w-9 -translate-x-1/2 rounded-full bg-slate-500/80' />
        <div className='absolute inset-x-5 bottom-10 top-9 flex items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-slate-950'>
          <IconDeviceDesktop
            className='size-14 text-primary drop-shadow-[0_0_14px_hsl(var(--primary)/0.55)]'
            stroke={1.75}
          />
        </div>
        <div className='absolute bottom-5 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-primary/70 shadow-[0_0_18px_hsl(var(--primary))]' />
      </div>
      <StatusSplash
        title={title}
        description={description}
        detail={detail}
        tone={tone}
        icon={
          icon ??
          (tone === 'danger' ? <IconAlertTriangle className='size-10' /> : <IconDeviceDesktop className='size-10' />)
        }
        className='min-h-0 w-full'
      />
    </div>
  </main>
)

const viewerUnavailableDetail = 'Refresh the viewer or restart the app, then try again.'

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
    transport: searchParams?.transport === 'websocket' ? 'websocket' : 'webrtc',
    bitrateMbps: numberParam(searchParams?.bitrateMbps, defaultViewerSettings.bitrateMbps),
    maxFps: numberParam(searchParams?.maxFps, defaultViewerSettings.maxFps),
    maxSize: numberParam(searchParams?.maxSize, defaultViewerSettings.maxSize),
    iFrameInterval: numberParam(searchParams?.iFrameInterval, defaultViewerSettings.iFrameInterval),
    fitToFrame: searchParams?.fitToFrame === '1'
  })

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

export async function DisplayViewerPage({
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
  } catch {
    return (
      <ViewerSplash
        title='Viewer unavailable'
        description='The app must be running before a display viewer stream can be opened.'
        detail={viewerUnavailableDetail}
        tone='danger'
      />
    )
  }

  if (!session.viewerServiceConfigured) {
    return (
      <ViewerSplash
        title='Viewer unavailable'
        description='The live display service is not ready.'
        detail={viewerUnavailableDetail}
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

  if (!(await checkDisplaySidecarTarget())) {
    return (
      <ViewerSplash
        title='Viewer transport unavailable'
        description='The app is running, but the live display cannot be reached.'
        detail={viewerUnavailableDetail}
        tone='danger'
      />
    )
  }

  const viewerUrl = getProtectedDisplaySidecarUrl({
    session,
    baseUrl: await getBaseUrl(),
    soundEnabled: viewerSettings.soundEnabled,
    settings: viewerSettings
  })

  return (
    <main className='relative min-h-screen overflow-hidden bg-background'>
      <ViewerActivityKeepalive applicationId={session.applicationId} />
      <Visible when={!session.viewerTargetConnected}>
        <div className='absolute left-3 right-3 top-3 z-10 rounded-md border border-destructive/35 bg-destructive/20 px-3 py-2 text-xs text-foreground backdrop-blur-md'>
          {viewerIssue?.kind === 'warning' ? viewerIssue.banner : 'Viewer connection could not be confirmed yet.'}
        </div>
      </Visible>
      <DisplayViewerFrame
        src={viewerUrl}
        keyboardCaptureEnabled={viewerSettings.keyboardCaptureEnabled}
      />
      <div className='pointer-events-none absolute inset-0 hidden items-center justify-center bg-background/80 text-secondary-foreground'>
        <IconLoader2 className='size-8 animate-spin' />
      </div>
    </main>
  )
}
