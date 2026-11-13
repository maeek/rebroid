'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDesktopViewport } from '@/hooks/use-desktop-viewport'
import { MiniPlayerDisplay } from './mini-player-display'
import { PinnedViewerContext, type DockedViewer } from './pinned-viewer-context'

type ViewerEntry = { registration: symbol; viewer: DockedViewer; attached: boolean; generationOffset: number }
type ViewerState = {
  viewers: Record<string, ViewerEntry>
  pinned?: string
  restoring?: string
  expanded: boolean
}

const closePlayer = (state: ViewerState) => ({
  ...state,
  pinned: undefined,
  restoring: undefined,
  expanded: false,
  viewers: Object.fromEntries(Object.entries(state.viewers).filter(([, viewer]) => viewer.attached))
})

export const PinnedViewerProvider = ({ children }: { children: ReactNode }) => {
  const isDesktop = useDesktopViewport() === true
  const [state, setState] = useState<ViewerState>({ viewers: {}, expanded: false })
  const [hostElements] = useState(() => new Map<string, HTMLDivElement>())
  const currentState = useRef(state)
  useLayoutEffect(() => {
    currentState.current = state
  }, [state])
  // A player opened on desktop stays mounted when its window becomes narrow.
  const activePin = state.pinned

  const getSession = useCallback((appId: string, runtime: string) => {
    const { pinned, viewers } = currentState.current
    const viewer = pinned === appId ? viewers[appId]?.viewer : undefined
    if (viewer?.runtime === runtime) return { ...viewer.session, runtime }
  }, [])

  const register = useCallback((registration: symbol, viewer: DockedViewer) => {
    setState(current => {
      const previous = current.viewers[viewer.appId]
      let generationOffset = 0
      if (previous?.viewer.surface.sessionId === viewer.surface.sessionId) {
        generationOffset =
          previous.registration === registration ? previous.generationOffset : previous.viewer.frameGeneration
      }
      const next = {
        ...current,
        viewers: {
          ...current.viewers,
          [viewer.appId]: {
            registration,
            viewer: { ...viewer, frameGeneration: viewer.frameGeneration + generationOffset },
            generationOffset,
            attached: true
          }
        }
      }
      return current.restoring === viewer.appId ? closePlayer(next) : next
    })
  }, [])

  const unregister = useCallback((registration: symbol) => {
    setState(current => {
      const entry = Object.entries(current.viewers).find(([, value]) => value.registration === registration)
      if (!entry) return current
      const [id, value] = entry
      const viewers = { ...current.viewers }
      if (current.pinned === id) viewers[id] = { ...value, attached: false }
      else delete viewers[id]
      return { ...current, viewers }
    })
  }, [])

  const minimize = useCallback(
    (id: string) => {
      if (!isDesktop) return
      setState(current => (current.viewers[id] ? { ...closePlayer(current), pinned: id } : current))
    },
    [isDesktop]
  )

  const restore = useCallback((id: string) => {
    setState(current => (current.viewers[id]?.attached ? closePlayer(current) : { ...current, restoring: id }))
  }, [])

  const requestFullscreen = useCallback(
    (id: string) => {
      const host = hostElements.get(id)
      if (!host?.requestFullscreen) return false
      void (document.fullscreenElement ? document.exitFullscreen() : host.requestFullscreen()).catch(() => undefined)
      return true
    },
    [hostElements]
  )

  const context = useMemo(
    () => ({
      isDesktop,
      pinnedAppId: activePin,
      getSession,
      register,
      unregister,
      minimize,
      restore,
      requestFullscreen
    }),
    [isDesktop, activePin, getSession, register, unregister, minimize, restore, requestFullscreen]
  )

  return (
    <PinnedViewerContext.Provider value={context}>
      {children}
      {Object.entries(state.viewers).map(([id, entry]) => {
        const floating = activePin === id
        if (!floating && !entry.attached) return null
        // This host stays outside the scrolling shell and survives route changes while minimized.
        return (
          <MiniPlayerDisplay
            key={id}
            viewer={entry.viewer}
            attached={entry.attached}
            floating={floating}
            expanded={floating && state.expanded}
            onExpandedChange={expanded => setState(current => ({ ...current, expanded }))}
            onRestore={() => restore(id)}
            onClose={() => setState(closePlayer)}
            onMinimize={isDesktop ? () => minimize(id) : undefined}
            hostElements={hostElements}
          />
        )
      })}
    </PinnedViewerContext.Provider>
  )
}
