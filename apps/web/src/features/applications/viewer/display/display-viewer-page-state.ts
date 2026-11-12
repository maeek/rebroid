import {
  checkDisplaySidecarTarget,
  describeViewerIssue,
  getViewerError,
  isLikelyRedroidImage,
  viewerSettingsFromSearchParams,
  viewerUnavailableDetail,
  type ViewerSearchParams
} from '@/features/applications/viewer/display/display-viewer-page-utils'
import {
  getViewerStartupDeadline,
  redroidViewerRefreshIntervalMs
} from '@/features/applications/viewer/display/display-viewer-startup'
import { PublicActionError } from '@/server/errors/public-action-error'
import { loadViewerPageApplication } from '@/server/orchestrator/applications/viewer-grant-access'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import type { AndroidApplication, ScrcpySession } from '@/shared/contracts/application'

type ViewerSplashState = {
  kind: 'splash'
  title: string
  description: string
  detail: string
  tone?: 'default' | 'danger'
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

const viewerUnavailable = (description: string, title = 'Viewer unavailable'): ViewerSplashState => ({
  kind: 'splash',
  title,
  description,
  detail: viewerUnavailableDetail,
  tone: 'danger'
})

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
  } catch {
    return viewerUnavailable('The app must be running before a display viewer stream can be opened.')
  }
  const { app } = opening
  const startupDeadline =
    app.status.currentStatus === 'running' && isLikelyRedroidImage(app.runtime.image)
      ? getViewerStartupDeadline(app.status.lastStartedAt, app.status.provisioningCompletedAt)
      : null

  let session: ScrcpySession
  try {
    session = await opening.openSession()
  } catch (error) {
    const pending = isRetryableSessionError(error)
      ? pendingStartupState(
          startupDeadline,
          'The app is running, but the live display connection is still getting ready.'
        )
      : null
    return pending ?? viewerUnavailable('The live display session could not be opened.')
  }

  if (!session.viewerServiceConfigured) {
    return {
      kind: 'splash',
      title: 'Viewer unavailable',
      description: 'The live display service is not ready.',
      detail: viewerUnavailableDetail
    }
  }

  const viewerIssue = !session.viewerTargetConnected
    ? describeViewerIssue({
        viewerError: getViewerError(session),
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
    return {
      kind: 'splash',
      title: viewerIssue.title,
      description: viewerIssue.description,
      detail: viewerIssue.detail,
      tone: 'danger'
    }
  }

  if (!(await checkDisplaySidecarTarget())) {
    return viewerUnavailable(
      'The app is running, but the live display cannot be reached.',
      'Viewer transport unavailable'
    )
  }

  if (!session.displaySession?.viewerPath) {
    return (
      pendingStartupState(
        startupDeadline,
        'The app is running, but the live display session is still getting ready.'
      ) ?? {
        kind: 'splash',
        title: 'Viewer session unavailable',
        description: 'The app is running, but the live display session could not be created.',
        detail: viewerUnavailableDetail,
        tone: 'danger'
      }
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
