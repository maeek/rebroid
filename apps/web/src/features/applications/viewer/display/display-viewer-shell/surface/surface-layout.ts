import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const surfaceChromeHeight = 40
export const workspaceVerticalPadding = 24
export const fallbackDisplayViewportHeight = 640

export const surfaceAspectRatio = (surface: DisplayViewerSurface, rotated: boolean) =>
  rotated
    ? surface.displaySize.height / surface.displaySize.width
    : surface.displaySize.width / surface.displaySize.height

export const fitAspectRatio = (ratio: number, maxWidth: number, maxHeight: number) => {
  const widthFromHeight = maxHeight * ratio
  if (widthFromHeight <= maxWidth) {
    return {
      width: Math.round(widthFromHeight),
      height: Math.round(maxHeight)
    }
  }

  return {
    width: Math.round(maxWidth),
    height: Math.round(maxWidth / ratio)
  }
}

export const getDisplayViewportSize = ({
  rotated,
  surface,
  workspaceHeight
}: {
  rotated: boolean
  surface: DisplayViewerSurface
  workspaceHeight: number
}) => {
  const availableHeight =
    workspaceHeight > 0
      ? Math.max(240, workspaceHeight - workspaceVerticalPadding - surfaceChromeHeight)
      : fallbackDisplayViewportHeight
  const ratio = surfaceAspectRatio(surface, rotated)

  return {
    height: Math.round(availableHeight),
    width: Math.round(availableHeight * ratio)
  }
}

export const getFullscreenMediaSize = ({
  rotated,
  surface,
  windowSize
}: {
  rotated: boolean
  surface: DisplayViewerSurface
  windowSize: { width: number; height: number }
}) => {
  const ratio = surfaceAspectRatio(surface, rotated)
  const maxWidth = windowSize.width || fallbackDisplayViewportHeight * ratio
  const maxHeight = windowSize.height || fallbackDisplayViewportHeight

  return fitAspectRatio(ratio, maxWidth, maxHeight)
}
