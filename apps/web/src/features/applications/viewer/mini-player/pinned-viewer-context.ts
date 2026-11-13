'use client'

import { createContext, useContext } from 'react'
import type {
  DisplayViewerStreamMetrics,
  DisplayViewerStreamStatus
} from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { DisplaySize, DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'
import type { ScrcpySession } from '@/shared/contracts/application'

export type DockedViewer = {
  appId: string
  name: string
  runtime: string
  session: { value: ScrcpySession; requestAt: number }
  element: HTMLDivElement
  surface: DisplayViewerSurface
  frameGeneration: number
  displaySize: DisplaySize
  canControl: boolean
  canClipboard: boolean
  isActive: boolean
  keyboardCaptureEnabled: boolean
  onStreamMetrics: (metrics: DisplayViewerStreamMetrics) => void
  onStreamStatus: (status: DisplayViewerStreamStatus) => void
  onRetry: () => void
  onFocus?: () => void
  retrying: boolean
  retryError: string | null
}

export const PinnedViewerContext = createContext<{
  isDesktop: boolean
  pinnedAppId: string | undefined
  getSession: (
    appId: string,
    runtime: string
  ) => { value: ScrcpySession; requestAt: number; runtime: string } | undefined
  register: (registration: symbol, viewer: DockedViewer) => void
  unregister: (registration: symbol) => void
  minimize: (appId: string) => void
  restore: (appId: string) => void
  requestFullscreen: (appId: string) => boolean
} | null>(null)

export const usePinnedViewer = () => useContext(PinnedViewerContext)
