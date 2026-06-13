import { getRedroidDisplayDimensionsFromArgs } from '@rebroid/application-core/redroid-runtime'
import { getProtectedViewerShellUrl } from '@/features/applications/viewer/display/display-viewer-url'
import { cn } from '@/lib/utils'
import type { ViewerOrientation } from './android-viewer'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'

type ViewerFrameLayout = {
  aspectRatio: string
  fullscreenHeight: string
  fullscreenMaxHeight: string
  fullscreenMaxWidth: string
  fullscreenWidth: string
  nonFullscreenMaxHeight: string
  nonFullscreenMaxWidth: string
  nonFullscreenWidth: string
}

const getViewerFrameSize = (app: AppDefinition | undefined, orientation: ViewerOrientation) => {
  const display = getRedroidDisplayDimensionsFromArgs(app?.containerArgs)
  const naturalLandscape = display.width >= display.height
  const isLandscape = orientation === 'landscape'

  return {
    width: isLandscape === naturalLandscape ? display.width : display.height,
    height: isLandscape === naturalLandscape ? display.height : display.width
  }
}

const getFullscreenHeight = (isWide: boolean, maxHeight: string, maxWidth: string, aspectRatioValue: number) =>
  isWide ? `min(${maxHeight}, calc(${maxWidth} / ${aspectRatioValue}))` : maxHeight

const getFullscreenWidth = (isWide: boolean, maxHeight: string, maxWidth: string, aspectRatioValue: number) =>
  isWide ? maxWidth : `min(${maxWidth}, calc(${maxHeight} * ${aspectRatioValue}))`

export const getViewerFrameLayout = (
  app: AppDefinition | undefined,
  orientation: ViewerOrientation
): ViewerFrameLayout => {
  const { width, height } = getViewerFrameSize(app, orientation)
  const aspectRatioValue = width / height
  const isWide = width > height
  const nonFullscreenMaxHeight = isWide ? 'min(70vh, 42rem)' : 'min(72vh, 54rem)'
  const nonFullscreenMaxWidth = isWide ? '68rem' : '28rem'
  const fullscreenMaxHeight = '100dvh'
  const fullscreenMaxWidth = '100dvw'

  return {
    aspectRatio: `${width} / ${height}`,
    fullscreenHeight: getFullscreenHeight(isWide, fullscreenMaxHeight, fullscreenMaxWidth, aspectRatioValue),
    fullscreenMaxHeight,
    fullscreenMaxWidth,
    fullscreenWidth: getFullscreenWidth(isWide, fullscreenMaxHeight, fullscreenMaxWidth, aspectRatioValue),
    nonFullscreenMaxHeight,
    nonFullscreenMaxWidth,
    nonFullscreenWidth: `min(100%, ${nonFullscreenMaxWidth}, calc(${nonFullscreenMaxHeight} * ${aspectRatioValue}))`
  }
}

const isReadyViewerApp = (app?: AppDefinition): app is AppDefinition =>
  Boolean(app?.id && app.running && app.status === 'running')

export const getViewerSrc = (app: AppDefinition | undefined, viewerSettings: ViewerSettings | undefined) =>
  isReadyViewerApp(app) ? getProtectedViewerShellUrl(app.id, viewerSettings) : null

const selectFullscreenValue = <T>(fullscreen: boolean | undefined, fullscreenValue: T, standardValue: T) =>
  fullscreen ? fullscreenValue : standardValue

export const getViewerFrameStyle = (layout: ViewerFrameLayout, fullscreen?: boolean) => ({
  aspectRatio: layout.aspectRatio,
  height: selectFullscreenValue(fullscreen, layout.fullscreenHeight, undefined),
  maxHeight: selectFullscreenValue(fullscreen, layout.fullscreenMaxHeight, layout.nonFullscreenMaxHeight),
  maxWidth: selectFullscreenValue(fullscreen, layout.fullscreenMaxWidth, layout.nonFullscreenMaxWidth),
  width: selectFullscreenValue(fullscreen, layout.fullscreenWidth, layout.nonFullscreenWidth)
})

export const getViewerFrameClassName = (fullscreen?: boolean) =>
  cn('relative flex w-full items-center justify-center overflow-hidden bg-black transition-all duration-150', {
    'h-full max-h-full max-w-full': fullscreen,
    'rounded-2xl border border-surface-border/55 shadow-[0_18px_48px_rgba(0,0,0,0.28)] ring-1 ring-white/5 oled:border-surface-border/65 oled:bg-surface-panel oled:shadow-none oled:ring-white/8':
      !fullscreen
  })
