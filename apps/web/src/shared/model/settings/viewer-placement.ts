export const viewerPlacementCookie = 'rebroid-viewer-placement'

export type ViewerPlacement = 'right' | 'top'

export const viewerPlacementOptions = [
  { value: 'right', label: 'Viewer on the right' },
  { value: 'top', label: 'Viewer on top' }
] as const

export const isViewerPlacement = (value: unknown): value is ViewerPlacement => value === 'right' || value === 'top'
