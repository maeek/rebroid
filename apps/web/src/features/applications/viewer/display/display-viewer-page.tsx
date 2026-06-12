import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/application-core/redroid-runtime'
import { IconLoader2 } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import {
  checkDisplaySidecarTarget,
  describeViewerIssue,
  getBaseUrl,
  getViewerError,
  getViewerStartupDeadline,
  isLikelyRedroidImage,
  redroidViewerRefreshIntervalMs,
  viewerSettingsFromSearchParams,
  viewerUnavailableDetail,
  type ViewerSearchParams
} from '@/features/applications/viewer/display/display-viewer-page-utils'
import { DisplayViewerProvider } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { DisplayViewerShell } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-shell'
import { ViewerSplash } from '@/features/applications/viewer/display/display-viewer-splash'
import { buildDisplayViewerSurfaces } from '@/features/applications/viewer/display/display-viewer-surfaces'
import { getApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { getScrcpySessionAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import { ViewerActivityKeepalive, ViewerStartupRefresh } from './viewer-activity-keepalive'
import type { AndroidApplication, ScrcpySession } from '@/server/orchestrator/applications/types'

export type { ViewerSearchParams } from '@/features/applications/viewer/display/display-viewer-page-utils'

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
  const controlsEnabled = resolvedSearchParams?.controls === '1'
  const selectedSurfaceId = resolvedSearchParams?.surfaceId

  let app: AndroidApplication
  try {
    app = await getApplicationAction(id)
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

  let session: ScrcpySession
  try {
    session = await getScrcpySessionAction(id)
  } catch {
    const startupDeadline = getViewerStartupDeadline(app.status.lastStartedAt)
    if (
      app.status.currentStatus === 'running' &&
      startupDeadline &&
      isLikelyRedroidImage(app.runtime.image) &&
      Date.now() < startupDeadline.getTime()
    ) {
      return (
        <ViewerStartupSplash
          title='Starting Android viewer'
          description='The app is running, but the live display connection is still getting ready.'
          detail={`Retrying every ${Math.round(redroidViewerRefreshIntervalMs / 1000)} seconds.`}
          deadlineAt={startupDeadline.toISOString()}
        />
      )
    }

    return (
      <ViewerSplash
        title='Viewer unavailable'
        description='The live display session could not be opened.'
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
      <ViewerStartupSplash
        title={viewerIssue.title}
        description={viewerIssue.description}
        detail={viewerIssue.detail}
        deadlineAt={viewerIssue.deadlineAt}
      />
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

  if (!session.displaySession?.viewerPath) {
    const startupDeadline = getViewerStartupDeadline(app.status.lastStartedAt)
    if (startupDeadline && isLikelyRedroidImage(app.runtime.image) && Date.now() < startupDeadline.getTime()) {
      return (
        <ViewerStartupSplash
          title='Starting Android viewer'
          description='The app is running, but the live display session is still getting ready.'
          detail={`Retrying every ${Math.round(redroidViewerRefreshIntervalMs / 1000)} seconds.`}
          deadlineAt={startupDeadline.toISOString()}
        />
      )
    }

    return (
      <ViewerSplash
        title='Viewer session unavailable'
        description='The app is running, but the live display session could not be created.'
        detail={viewerUnavailableDetail}
        tone='danger'
      />
    )
  }

  const baseUrl = await getBaseUrl()
  const mainDisplaySize = getRedroidDisplayDimensionsFromArgs(app.runtime.containerArgs)
  const surfaces = buildDisplayViewerSurfaces({
    session,
    baseUrl,
    soundEnabled: viewerSettings.soundEnabled,
    settings: viewerSettings,
    mainDisplaySize,
    selectedSurfaceId,
    controlsEnabled
  })

  return (
    <main className='relative min-h-screen overflow-hidden bg-background'>
      <ViewerActivityKeepalive applicationId={session.applicationId} />
      <Visible when={!session.viewerTargetConnected}>
        <div className='absolute left-3 right-3 top-3 z-10 rounded-md border border-destructive/35 bg-destructive/20 px-3 py-2 text-xs text-foreground backdrop-blur-md'>
          {viewerIssue?.kind === 'warning' ? viewerIssue.banner : 'Viewer connection could not be confirmed yet.'}
        </div>
      </Visible>
      <DisplayViewerProvider
        value={{
          applicationId: session.applicationId,
          surfaces,
          initialKeyboardCaptureEnabled: viewerSettings.keyboardCaptureEnabled,
          controlsEnabled,
          canControl: session.displaySession.capabilities.includes('control'),
          canCaptureScreenshot: session.displaySession.capabilities.includes('screenshot')
        }}
      >
        <DisplayViewerShell />
      </DisplayViewerProvider>
      <div className='pointer-events-none absolute inset-0 hidden items-center justify-center bg-background/80 text-secondary-foreground'>
        <IconLoader2 className='size-8 animate-spin' />
      </div>
    </main>
  )
}

const ViewerStartupSplash = ({
  title,
  description,
  detail,
  deadlineAt
}: {
  title: string
  description: string
  detail: string
  deadlineAt: string
}) => (
  <>
    <ViewerStartupRefresh
      deadlineAt={deadlineAt}
      intervalMs={redroidViewerRefreshIntervalMs}
    />
    <ViewerSplash
      title={title}
      description={description}
      detail={detail}
      icon={<IconLoader2 className='size-10 animate-spin' />}
    />
  </>
)
