import { unstable_rethrow } from 'next/navigation'
import {
  checkDisplaySidecarTarget,
  describeViewerIssue,
  getViewerError,
  isLikelyRedroidImage,
  viewerSettingsFromSearchParams,
  type ViewerSearchParams
} from '@/features/applications/viewer/display/display-viewer-page-utils'
import {
  getViewerStartupDeadline,
  redroidViewerRefreshIntervalMs
} from '@/features/applications/viewer/display/display-viewer-startup'
import { PublicActionError } from '@/server/errors/public-action-error'
import { loadViewerPageApplication } from '@/server/orchestrator/applications/viewer-grant-access'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { appResourceHref } from '@/shared/model/applications/app-resource-links'
import type { AndroidApplication, ScrcpySession } from '@/shared/contracts/application'

type ViewerSplashState = {
  kind: 'splash'
  title: string
  description: string
  detail?: string
  appHref?: string
  retry?: boolean
  requestId?: string
}

type ViewerStartupState = {
  kind: 'startup'
  title: string
  description: string
  detail: string
  deadlineAt: string
}

type ViewerReadyState = {
  kind: 'ready'
  app: AndroidApplication
  controlsEnabled: boolean
  selectedSurfaceId?: string
  session: ScrcpySession
  viewerSettings: ReturnType<typeof viewerSettingsFromSearchParams>
  warningBanner: string | null
}

export type DisplayViewerPageState = ViewerSplashState | ViewerStartupState | ViewerReadyState

const startupRetryDetail = `Retrying every ${Math.round(redroidViewerRefreshIntervalMs / 1000)} seconds.`

const viewerUnavailable = (state: Omit<ViewerSplashState, 'kind'>): ViewerSplashState => ({
  kind: 'splash',
  ...state
})

const appUnavailable = () =>
  viewerUnavailable({ title: 'App unavailable', description: 'This app could not be opened with your account.' })

const lookupIsUnavailableToUser = (error: unknown) =>
  (error instanceof PublicActionError && (error.code === 'not_found' || error.code === 'forbidden')) ||
  (error instanceof OrchestratorRequestError && (error.status === 404 || error.status === 403))

const requestReference = (error: unknown) =>
  error instanceof OrchestratorRequestError && error.requestId !== 'unknown' ? error.requestId : undefined

const startupState = ({
  deadlineAt,
  description,
  title
}: {
  deadlineAt: string
  description: string
  title: string
}): ViewerStartupState => ({
  kind: 'startup',
  title,
  description,
  detail: startupRetryDetail,
  deadlineAt
})

const pendingStartupState = (startupDeadline: Date | null, description: string): ViewerStartupState | null => {
  if (!startupDeadline || Date.now() >= startupDeadline.getTime()) {
    return null
  }

  return startupState({
    title: 'Starting Android viewer',
    description,
    deadlineAt: startupDeadline.toISOString()
  })
}

const isRetryableSessionError = (error: unknown) =>
  (error instanceof PublicActionError && error.code === 'upstream_unavailable') ||
  (error instanceof OrchestratorRequestError && [502, 503, 504].includes(error.status))

export const resolveDisplayViewerPageState = async ({
  id,
  searchParams
}: {
  id: string
  searchParams?: ViewerSearchParams
}): Promise<DisplayViewerPageState> => {
  const viewerSettings = viewerSettingsFromSearchParams(searchParams)
  const controlsEnabled = searchParams?.controls === '1'
  const selectedSurfaceId = searchParams?.surfaceId

  let opening: Awaited<ReturnType<typeof loadViewerPageApplication>>
  try {
    opening = await loadViewerPageApplication(id)
  } catch (error) {
    unstable_rethrow(error)
    if (lookupIsUnavailableToUser(error)) return appUnavailable()
    return viewerUnavailable({
      title: 'Could not load app',
      description: 'Rebroid could not check the app’s status.',
      retry: true,
      requestId: requestReference(error)
    })
  }
  const { app } = opening
  const appHref = appResourceHref(app.id)
  if (opening.isForeignOwnedApp) {
    return viewerUnavailable({
      title: 'Display unavailable in administrator view',
      description: 'Only the app owner can open this live display.',
      appHref
    })
  }
  if (app.status.currentStatus !== 'running') {
    const stopped = app.status.currentStatus === 'stopped'
    return viewerUnavailable({
      title: stopped ? 'App is stopped' : 'App is not running',
      description: stopped
        ? 'The live display is available once the app is running.'
        : 'Open the app to check its current status.',
      appHref
    })
  }
  const startupDeadline = isLikelyRedroidImage(app.runtime.image)
    ? getViewerStartupDeadline(app.status.lastStartedAt, app.status.provisioningCompletedAt)
    : null

  let session: ScrcpySession
  try {
    session = await opening.openSession()
  } catch (error) {
    unstable_rethrow(error)
    if (error instanceof PublicActionError && error.code === 'forbidden') {
      return viewerUnavailable({
        title: 'Viewer access unavailable',
        description: 'Rebroid could not authorize a live display for this account session.',
        appHref
      })
    }
    if (lookupIsUnavailableToUser(error)) return appUnavailable()
    if (error instanceof OrchestratorRequestError && error.status === 409) {
      return viewerUnavailable({
        title: 'App is not ready for viewing',
        description: 'The app’s runtime changed while opening the display.',
        appHref
      })
    }
    const pending = isRetryableSessionError(error)
      ? pendingStartupState(
          startupDeadline,
          'The app is running, but the live display connection is still getting ready.'
        )
      : null
    return (
      pending ??
      viewerUnavailable({
        title: 'Could not open live display',
        description: 'Rebroid could not start a display session.',
        appHref,
        retry: true,
        requestId: requestReference(error)
      })
    )
  }

  if (!session.viewerServiceConfigured) {
    return viewerUnavailable({
      title: 'Display service unavailable',
      description: 'The live display service is not ready.',
      appHref,
      retry: true
    })
  }

  const viewerError = getViewerError(session)
  const viewerIssue = !session.viewerTargetConnected
    ? describeViewerIssue({
        viewerError,
        message: session.viewerMessage,
        startupDeadline
      })
    : null

  if (!session.viewerTargetConnected && viewerIssue?.kind === 'pending') {
    return {
      kind: 'startup',
      title: viewerIssue.title,
      description: viewerIssue.description,
      detail: viewerIssue.detail,
      deadlineAt: viewerIssue.deadlineAt
    }
  }

  if (!session.viewerTargetConnected && viewerIssue?.kind === 'fatal') {
    return viewerUnavailable({
      title: viewerIssue.title,
      description: viewerIssue.description,
      detail: viewerIssue.detail,
      appHref,
      retry: viewerError?.code !== 'adb_missing'
    })
  }

  if (!(await checkDisplaySidecarTarget())) {
    return viewerUnavailable({
      title: 'Viewer transport unavailable',
      description: 'The app is running, but the live display cannot be reached.',
      appHref,
      retry: true
    })
  }

  if (!session.displaySession?.viewerPath) {
    return (
      pendingStartupState(
        startupDeadline,
        'The app is running, but the live display session is still getting ready.'
      ) ??
      viewerUnavailable({
        title: 'Viewer session unavailable',
        description: 'The app is running, but the live display session could not be created.',
        appHref,
        retry: true
      })
    )
  }

  return {
    kind: 'ready',
    app,
    controlsEnabled,
    selectedSurfaceId,
    session,
    viewerSettings,
    warningBanner:
      viewerIssue?.kind === 'warning' ? viewerIssue.banner : 'Viewer connection could not be confirmed yet.'
  }
}
