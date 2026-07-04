import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/application-core/redroid-runtime'
import { IconLoader2 } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { resolveDisplayViewerPageState } from '@/features/applications/viewer/display/display-viewer-page-state'
import {
  getBaseUrl,
  redroidViewerRefreshIntervalMs,
  type ViewerSearchParams
} from '@/features/applications/viewer/display/display-viewer-page-utils'
import { DisplayViewerProvider } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { DisplayViewerShell } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-shell'
import { ViewerSplash } from '@/features/applications/viewer/display/display-viewer-splash'
import { buildDisplayViewerSurfaces } from '@/features/applications/viewer/display/display-viewer-surfaces'
import { ViewerActivityKeepalive, ViewerStartupRefresh } from './viewer-activity-keepalive'

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
  const state = await resolveDisplayViewerPageState({ id, searchParams: resolvedSearchParams })

  if (state.kind === 'startup') {
    return (
      <ViewerStartupSplash
        title={state.title}
        description={state.description}
        detail={state.detail}
        deadlineAt={state.deadlineAt}
      />
    )
  }

  if (state.kind === 'splash') {
    return (
      <ViewerSplash
        title={state.title}
        description={state.description}
        detail={state.detail}
        tone={state.tone}
      />
    )
  }

  const { app, controlsEnabled, selectedSurfaceId, session, viewerSettings } = state
  const displaySession = session.displaySession
  if (!displaySession) return null

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
          {state.warningBanner}
        </div>
      </Visible>
      <DisplayViewerProvider
        value={{
          applicationId: session.applicationId,
          surfaces,
          initialKeyboardCaptureEnabled: viewerSettings.keyboardCaptureEnabled,
          controlsEnabled,
          canControl: displaySession.capabilities.includes('control'),
          canCaptureScreenshot: displaySession.capabilities.includes('screenshot')
        }}
      >
        <DisplayViewerShell />
      </DisplayViewerProvider>
      <div className='pointer-events-none absolute inset-0 hidden items-center justify-center bg-background/80 text-foreground-muted'>
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
