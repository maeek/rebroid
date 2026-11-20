'use client'

import { createContext, useContext } from 'react'
import type { DisplaySize, DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'
import type { ScrcpySession } from '@/shared/contracts/application'
import type { ViewerStreamMetricsV4, ViewerStreamStatus } from '@rebroid/android-application-core/viewer-stream'

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
  onStreamMetrics: (metrics: ViewerStreamMetricsV4) => void
  onStreamStatus: (status: ViewerStreamStatus) => void
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
  isFullscreenHost: (appId: string, element: Element) => boolean
} | null>(null)

export const usePinnedViewer = () => useContext(PinnedViewerContext)
