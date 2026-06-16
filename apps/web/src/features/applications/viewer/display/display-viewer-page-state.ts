import {
  checkDisplaySidecarTarget,
  describeViewerIssue,
  getViewerError,
  getViewerStartupDeadline,
  isLikelyRedroidImage,
  redroidViewerRefreshIntervalMs,
  viewerSettingsFromSearchParams,
  viewerUnavailableDetail,
  type ViewerSearchParams
} from '@/features/applications/viewer/display/display-viewer-page-utils'
import { getApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { getScrcpySessionAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import type { AndroidApplication, ScrcpySession } from '@/server/orchestrator/applications/types'

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

const pendingStartupState = (app: AndroidApplication, description: string): ViewerStartupState | null => {
  const startupDeadline = getViewerStartupDeadline(app.status.lastStartedAt)
  if (
    app.status.currentStatus !== 'running' ||
    !startupDeadline ||
    !isLikelyRedroidImage(app.runtime.image) ||
    Date.now() >= startupDeadline.getTime()
  ) {
    return null
  }

  return startupState({
    title: 'Starting Android viewer',
    description,
    deadlineAt: startupDeadline.toISOString()
  })
}

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

  let app: AndroidApplication
  try {
    app = await getApplicationAction(id)
  } catch {
    return viewerUnavailable('The app must be running before a display viewer stream can be opened.')
  }

  let session: ScrcpySession
  try {
    session = await getScrcpySessionAction(id)
  } catch {
    return (
      pendingStartupState(app, 'The app is running, but the live display connection is still getting ready.') ??
      viewerUnavailable('The live display session could not be opened.')
    )
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
        containerImage: app.runtime.image,
        lastStartedAt: app.status.lastStartedAt
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
    return viewerUnavailable('The app is running, but the live display cannot be reached.', 'Viewer transport unavailable')
  }

  if (!session.displaySession?.viewerPath) {
    return (
      pendingStartupState(app, 'The app is running, but the live display session is still getting ready.') ?? {
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
