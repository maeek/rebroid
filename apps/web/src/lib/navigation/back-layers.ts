import { flushSync } from 'react-dom'

const stateKey = 'rebroidBackLayer'

type HistoryEntry = { id: string; part: 'page' | 'layer'; href: string }
type BackHandler = () => void | 'continue'
type BackLayer = { pathname: string; priority: 'guard' | 'screen' | 'overlay'; onBack: BackHandler }
type NavigationHistory = {
  currentEntry: { index: number; key: string } | null
  entries: () => { url: string | null }[]
}

const layers = new Set<BackLayer>()
let listening = false
let lastLayerEntry: (HistoryEntry & { key: string | undefined }) | undefined
let departing: { id: string; after?: () => void } | undefined
let nextId = 0
const priorities = { guard: 0, screen: 1, overlay: 2 }

const readEntry = (state: unknown): HistoryEntry | undefined => {
  if (!state || typeof state !== 'object' || !(stateKey in state)) return
  const entry = state[stateKey]
  if (!entry || typeof entry !== 'object' || !('id' in entry) || !('part' in entry) || !('href' in entry)) return
  if (
    typeof entry.id === 'string' &&
    typeof entry.href === 'string' &&
    (entry.part === 'page' || entry.part === 'layer')
  ) {
    return { id: entry.id, part: entry.part, href: entry.href }
  }
}

const currentEntry = () => readEntry(window.history.state)
const currentLayerEntry = () => {
  const entry = currentEntry()
  return entry?.part === 'layer' && entry.href === window.location.href ? entry : undefined
}

const getNavigationHistory = () => (window as Window & { navigation?: NavigationHistory }).navigation
const rememberLayerEntry = (entry: HistoryEntry | undefined) => {
  lastLayerEntry = entry && { ...entry, key: getNavigationHistory()?.currentEntry?.key }
}

export const previousPageUrl = () => {
  const navigation = getNavigationHistory()
  const current = navigation?.currentEntry
  if (!navigation || !current) return null
  const href = navigation.entries()[current.index - 1]?.url
  return href ? new URL(href) : null
}

const topLayer = () => {
  let top: BackLayer | undefined
  for (const layer of layers) {
    if (layer.pathname !== window.location.pathname) continue
    if (!top || priorities[layer.priority] >= priorities[top.priority]) top = layer
  }
  return top
}

const addBackEntry = (base: HistoryEntry | undefined) => {
  const href = window.location.href
  const page: HistoryEntry =
    base?.part === 'page' && base.href === href
      ? base
      : { id: `${performance.timeOrigin}:${++nextId}`, part: 'page', href }
  // Retain the current Next.js router snapshot on both entries without changing the URL.
  const state = window.history.state as Record<string, unknown> | null
  if (page !== base) window.history.replaceState({ ...state, [stateKey]: page }, '')
  const layer: HistoryEntry = { ...page, part: 'layer' }
  window.history.pushState({ ...state, [stateKey]: layer }, '')
  rememberLayerEntry(layer)
}

const stillInEntry = (entry: typeof lastLayerEntry) =>
  Boolean(entry?.key && entry.key === getNavigationHistory()?.currentEntry?.key)

const syncBackEntry = () => {
  if (departing) return
  const existing = currentLayerEntry()
  const previous = lastLayerEntry

  if (!existing && previous && stillInEntry(previous)) {
    const href = window.location.href
    const state = window.history.state as Record<string, unknown> | null
    if (previous.href !== href) {
      // A route replace rewrote the overlay entry. Apply it to the page beneath that entry.
      departing = {
        id: previous.id,
        after: () => {
          window.history.replaceState(state, '', href)
          syncBackEntry()
        }
      }
      window.history.back()
      return
    }
    window.history.replaceState({ ...state, [stateKey]: previous }, '')
  }

  rememberLayerEntry(currentLayerEntry())
  if (topLayer()) {
    if (!lastLayerEntry) addBackEntry(currentEntry())
  } else if (lastLayerEntry) {
    departing = { id: lastLayerEntry.id }
    window.history.back()
  }
}

const handlePop = (event: PopStateEvent) => {
  const from = lastLayerEntry
  const target = readEntry(event.state)
  const dismissal = departing
  departing = undefined
  rememberLayerEntry(target?.part === 'layer' ? target : undefined)

  if (!from || target?.part !== 'page' || target.id !== from.id || target.href !== window.location.href) return

  // A same-URL step belongs to the overlay, so let Next handle only actual route changes.
  event.stopImmediatePropagation()
  if (dismissal?.id === from.id) {
    dismissal.after?.()
    if (!dismissal.after) syncBackEntry()
    return
  }

  const layer = topLayer()
  if (!layer) {
    // A link followed from an overlay may leave its entry behind. Skip that entry on the next Back.
    window.history.back()
    return
  }

  if (flushSync(layer.onBack) === 'continue') {
    window.history.back()
    return
  }
  syncBackEntry()
}

export const refreshBackLayersForRoute = () => {
  if (!listening || departing) return
  const entry = currentLayerEntry()
  if (!entry || topLayer()) syncBackEntry()
  else rememberLayerEntry(entry)
}

export const registerBackLayer = (priority: BackLayer['priority'], onBack: BackHandler) => {
  if (!listening) {
    window.addEventListener('popstate', handlePop, true)
    listening = true
  }
  const layer = { pathname: window.location.pathname, priority, onBack }
  layers.add(layer)
  syncBackEntry()
  return () => {
    layers.delete(layer)
    // Effects can swap one surface for another in the same commit.
    queueMicrotask(syncBackEntry)
  }
}

export const afterClosingBackEntry = (action: () => void) => {
  const previous = lastLayerEntry
  const restored = previous?.href === window.location.href && stillInEntry(previous) ? previous : undefined
  const entry = currentLayerEntry() ?? restored
  if (!entry) {
    action()
    return
  }
  rememberLayerEntry(entry)
  const alreadyDeparting = departing?.id === entry.id
  departing = { id: entry.id, after: action }
  if (!alreadyDeparting) window.history.back()
}
