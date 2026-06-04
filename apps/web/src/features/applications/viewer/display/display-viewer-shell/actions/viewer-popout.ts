import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const openViewerPopout = (applicationId: string, surface: DisplayViewerSurface) => {
  window.open(
    surface.popoutUrl,
    `rebroid-viewer-${applicationId}-${surface.id}`,
    'popup=yes,width=960,height=960,noopener,noreferrer'
  )
}
