'use client'

import { FloatingViewerControls } from '@/features/applications/viewer/display/viewer-control-bar/floating/floating-viewer-controls'
import { StandardViewerControls } from '@/features/applications/viewer/display/viewer-control-bar/standard/standard-viewer-controls'

type ViewerControlBarProps = {
  mode?: 'bar' | 'floating'
}

export const ViewerControlBar = ({ mode = 'bar' }: ViewerControlBarProps) =>
  mode === 'floating' ? <FloatingViewerControls /> : <StandardViewerControls />
