const surfaceChromeHeight = 32
export const workspacePadding = 16
export const viewerControlRailWidth = 32
const controlRailGap = 8
export const fallbackDisplayViewportHeight = 640

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
  ratio,
  workspaceSize,
  controlsEnabled
}: {
  ratio: number
  workspaceSize: { width: number; height: number; railWidth?: number }
  controlsEnabled: boolean
}) => {
  const railSpace = controlsEnabled ? (workspaceSize.railWidth ?? viewerControlRailWidth) + controlRailGap : 0
  const availableWidth = workspaceSize.width ? Math.max(1, workspaceSize.width - workspacePadding - railSpace) : 320
  const availableHeight = workspaceSize.height
    ? Math.max(1, workspaceSize.height - workspacePadding - surfaceChromeHeight)
    : fallbackDisplayViewportHeight
  const fitted = fitAspectRatio(ratio, availableWidth, availableHeight)
  return { ...fitted, width: Math.min(availableWidth, Math.max(120, fitted.width)) }
}
