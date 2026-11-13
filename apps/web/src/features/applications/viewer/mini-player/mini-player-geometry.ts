export type MiniPlayerSize = { width: number; height: number }
export type MiniPlayerPoint = { x: number; y: number }
export type MiniPlayerEdge = 'left' | 'right' | 'top' | 'bottom'
export type MiniPlayerDock = { edge: MiniPlayerEdge; offset: number }
export type MiniPlayerToolbarSide = 'left' | 'right'

export const miniPlayerViewportInset = 24
const miniPlayerHeaderHeightRem = 1.75
export const miniPlayerToolbarWidth = 36
export const miniPlayerToolbarGap = 8
export const miniPlayerToolbarSpace = miniPlayerToolbarWidth + miniPlayerToolbarGap
export const isVerticalEdge = (edge: MiniPlayerEdge) => edge === 'left' || edge === 'right'

export const fitMiniPlayer = ({
  viewport,
  ratio,
  expanded,
  preferredWidth,
  toolbarSpace,
  rem = 16
}: {
  viewport: MiniPlayerSize
  ratio: number
  expanded: boolean
  preferredWidth?: number
  toolbarSpace: number
  rem?: number
}) => {
  const availableWidth = Math.max(0, viewport.width - miniPlayerViewportInset * 2 - toolbarSpace)
  const headerHeight = miniPlayerHeaderHeightRem * rem
  const availableHeight = Math.max(0, viewport.height - miniPlayerViewportInset * 2 - headerHeight)
  let heightLimit = Math.min(viewport.height * 0.36, 18 * rem)
  if (expanded) heightLimit = preferredWidth === undefined ? Math.min(viewport.height * 0.6, 30 * rem) : availableHeight
  const width = Math.min(
    preferredWidth ?? (expanded ? 23 : 13) * rem,
    availableWidth,
    Math.min(heightLimit, availableHeight) * ratio
  )
  const videoHeight = width / ratio
  return { width, height: headerHeight + videoHeight, headerHeight, videoHeight }
}

export const getMiniPlayerBounds = (
  size: MiniPlayerSize,
  viewport: MiniPlayerSize,
  toolbarSpace: number,
  side: MiniPlayerToolbarSide
) => {
  const minX = miniPlayerViewportInset + (side === 'left' ? toolbarSpace : 0)
  const minY = miniPlayerViewportInset
  return {
    minX,
    minY,
    maxX: Math.max(minX, viewport.width - miniPlayerViewportInset - size.width - (side === 'right' ? toolbarSpace : 0)),
    maxY: Math.max(minY, viewport.height - miniPlayerViewportInset - size.height)
  }
}
export type MiniPlayerBounds = ReturnType<typeof getMiniPlayerBounds>

export const clampMiniPlayer = ({ x, y }: MiniPlayerPoint, bounds: MiniPlayerBounds): MiniPlayerPoint => ({
  x: Math.min(Math.max(bounds.minX, x), bounds.maxX),
  y: Math.min(Math.max(bounds.minY, y), bounds.maxY)
})

export const getMiniPlayerLayout = (
  dock: MiniPlayerDock,
  size: MiniPlayerSize,
  viewport: MiniPlayerSize,
  toolbarSpace: number,
  dragPosition: MiniPlayerPoint | null = null
) => {
  let toolbarSide: MiniPlayerToolbarSide = 'left'
  if (dock.edge === 'left' || (!isVerticalEdge(dock.edge) && dock.offset < 0.5)) toolbarSide = 'right'
  if (dragPosition) toolbarSide = dragPosition.x + size.width / 2 < viewport.width / 2 ? 'right' : 'left'
  const bounds = getMiniPlayerBounds(size, viewport, toolbarSpace, toolbarSide)
  const offset = Math.min(1, Math.max(0, dock.offset))
  let x = bounds.minX + (bounds.maxX - bounds.minX) * offset
  let y = bounds.minY + (bounds.maxY - bounds.minY) * offset
  if (dock.edge === 'left') x = bounds.minX
  if (dock.edge === 'right') x = bounds.maxX
  if (dock.edge === 'top') y = bounds.minY
  if (dock.edge === 'bottom') y = bounds.maxY
  return { ...clampMiniPlayer(dragPosition ?? { x, y }, bounds), toolbarSide, bounds }
}
