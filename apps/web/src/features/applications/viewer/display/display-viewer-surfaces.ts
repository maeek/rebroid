import {
  getProtectedDisplaySidecarSurfaceUrl,
  getProtectedDisplaySidecarUrl,
  getProtectedViewerShellUrl
} from '@/features/applications/viewer/display/display-viewer-url'
import type {
  DisplaySessionWithSurfaces,
  DisplaySurfaceRef
} from '@/features/applications/viewer/display/display-viewer-url'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { ScrcpySession } from '@/server/orchestrator/applications/types'

export type DisplaySize = {
  width: number
  height: number
}

export type DisplayViewerSurface = {
  id: string
  surfaceId: string
  sessionId: string
  kind: 'main' | 'virtual'
  name: string
  src: string
  popoutUrl: string
  displaySize: DisplaySize
  newDisplay?: {
    width: number
    height: number
    dpi: number
  }
}

export const getSurfaceDisplaySize = (surface: DisplaySurfaceRef, mainDisplaySize: DisplaySize): DisplaySize => {
  if (surface.kind === 'virtual') {
    return {
      width: surface.newDisplay?.width ?? 1280,
      height: surface.newDisplay?.height ?? 720
    }
  }

  return mainDisplaySize
}

const dedupeSurfaceItems = (surfaces: DisplaySurfaceRef[], preferredMainSessionId: string): DisplaySurfaceRef[] => {
  const seenSurfaceIds = new Set<string>()
  const deduped: DisplaySurfaceRef[] = []
  const preferredMainSurface = surfaces.find(
    surface => surface.kind === 'main' && surface.sessionId === preferredMainSessionId
  )
  const orderedSurfaces = preferredMainSurface
    ? [preferredMainSurface, ...surfaces.filter(surface => surface !== preferredMainSurface)]
    : surfaces

  for (const surface of orderedSurfaces) {
    const key = surface.kind === 'main' ? 'main' : surface.id
    if (seenSurfaceIds.has(key)) {
      continue
    }

    seenSurfaceIds.add(key)
    deduped.push(surface)
  }

  return deduped
}

export const buildDisplayViewerSurfaces = ({
  session,
  baseUrl,
  soundEnabled,
  settings,
  mainDisplaySize,
  selectedSurfaceId,
  controlsEnabled
}: {
  session: ScrcpySession
  baseUrl: string
  soundEnabled: boolean
  settings: ViewerSettings
  mainDisplaySize: DisplaySize
  selectedSurfaceId?: string
  controlsEnabled: boolean
}): DisplayViewerSurface[] => {
  if (!session.displaySession?.viewerPath) {
    return []
  }

  const mainSurface = session.displaySession as DisplaySessionWithSurfaces
  const mainViewerUrl = getProtectedDisplaySidecarUrl({
    session,
    baseUrl,
    soundEnabled,
    settings
  })
  const fallbackMainSurface: DisplaySurfaceRef = {
    id: 'main',
    sessionId: mainSurface.id,
    kind: 'main',
    name: 'Main display',
    viewerPath: mainSurface.viewerPath
  }
  const allSurfaceItems = mainSurface.surfaces?.length
    ? dedupeSurfaceItems(mainSurface.surfaces, mainSurface.id)
    : [mainSurface.surface ?? fallbackMainSurface]
  const selectedSurfaceItems =
    selectedSurfaceId && controlsEnabled
      ? allSurfaceItems.filter(surface => surface.id === selectedSurfaceId || surface.sessionId === selectedSurfaceId)
      : null
  const surfaceItems = selectedSurfaceItems?.length ? selectedSurfaceItems : allSurfaceItems

  return surfaceItems.map(surface => ({
    id: surface.id,
    surfaceId: surface.id,
    sessionId: surface.sessionId,
    kind: surface.kind,
    name: surface.name,
    newDisplay: surface.newDisplay,
    displaySize: getSurfaceDisplaySize(surface, mainDisplaySize),
    popoutUrl: getProtectedViewerShellUrl(session.applicationId, settings, {
      controls: true,
      surfaceId: surface.id
    }),
    src:
      surface.sessionId === mainSurface.id
        ? mainViewerUrl
        : getProtectedDisplaySidecarSurfaceUrl({
            surface,
            player: session.player,
            baseUrl,
            soundEnabled,
            settings
          })
  }))
}
