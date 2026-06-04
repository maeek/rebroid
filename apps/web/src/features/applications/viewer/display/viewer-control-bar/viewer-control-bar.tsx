'use client'

import { FloatingViewerControls } from '@/features/applications/viewer/display/viewer-control-bar/floating/floating-viewer-controls'
import { StandardViewerControls } from '@/features/applications/viewer/display/viewer-control-bar/standard/standard-viewer-controls'
import { ViewerControlProvider } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-context'

type ViewerControlBarProps = {
  mode?: 'bar' | 'floating'
  surfaceId?: string
}

export const ViewerControlBar = ({ mode = 'bar', surfaceId }: ViewerControlBarProps) => {
  return (
    <ViewerControlProvider
      mode={mode}
      surfaceId={surfaceId}
    >
      {mode === 'floating' ? <FloatingViewerControls /> : <StandardViewerControls />}
    </ViewerControlProvider>
  )
}
