import { getBff } from '@/lib/http/bff'
import { ActionResultError } from '@/shared/actions/action-result'
import type { AutomationRunEvent } from '@/shared/contracts/automation'

interface RunEventPage {
  events: AutomationRunEvent[]
  hasMore: boolean
  streamUrl: string
}

const readRunEventPage = (runId: string, after: number, signal?: AbortSignal) =>
  getBff<RunEventPage>(`/api/bff/automations/runs/${encodeURIComponent(runId)}/events?after=${after}`, signal)

const isTerminalEvent = ({ type }: AutomationRunEvent) =>
  type === 'run.completed' || type === 'run.failed' || type === 'run.canceled'

export const replayTerminalRunEvents = async ({
  runId,
  after,
  onEvents,
  isCurrent
}: {
  runId: string
  after: number
  onEvents: (events: AutomationRunEvent[]) => void
  isCurrent: () => boolean
}) => {
  let cursor = after
  for (const delay of [0, 250, 750, 2_000]) {
    if (!isCurrent()) return
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    let hasMore = true
    while (hasMore && isCurrent()) {
      const page = await readRunEventPage(runId, cursor).catch(() => null)
      if (!isCurrent()) return
      if (!page) break
      onEvents(page.events)
      if (page.events.some(isTerminalEvent)) return
      const next = page.events.at(-1)?.sequence ?? cursor
      hasMore = page.hasMore && next > cursor
      cursor = next
    }
  }
}

const readSocketEvent = (data: unknown, runId: string): AutomationRunEvent | undefined => {
  const payload = JSON.parse(String(data)) as { type?: unknown; event?: Partial<AutomationRunEvent> } | null
  if (payload?.type === 'heartbeat') return
  const event = payload?.event
  if (
    payload?.type !== 'event' ||
    !event ||
    event.runId !== runId ||
    !Number.isSafeInteger(event.sequence) ||
    typeof event.id !== 'string' ||
    typeof event.type !== 'string' ||
    typeof event.message !== 'string' ||
    typeof event.createdAt !== 'string' ||
    !event.data ||
    typeof event.data !== 'object' ||
    Array.isArray(event.data)
  ) {
    throw new Error('Invalid run event')
  }
  return event as AutomationRunEvent
}

interface RunEventSubscription {
  runId: string
  after?: number
  isCurrent?: () => boolean
  isLive?: () => boolean
  onEvents: (events: AutomationRunEvent[]) => void
  onReady?: () => void
  onError?: (reason: 'unavailable' | 'invalid-event') => void
}

export const subscribeToRunEvents = ({
  runId,
  after = 0,
  isCurrent,
  isLive,
  onEvents,
  onReady,
  onError
}: RunEventSubscription) => {
  const controller = new AbortController()
  let cursor = after
  let terminal = false
  let socket: WebSocket | null = null
  let retry: ReturnType<typeof setTimeout> | undefined
  const current = () => !controller.signal.aborted && isCurrent?.() !== false
  const live = () => !terminal && isLive?.() !== false

  const accept = (events: AutomationRunEvent[]) => {
    const next = events.filter(event => {
      if (event.runId !== runId || event.sequence <= cursor) return false
      cursor = event.sequence
      return true
    })
    if (next.length === 0) return
    terminal ||= next.some(isTerminalEvent)
    onEvents(next)
  }

  const reconnect = () => {
    if (current() && !terminal) retry = setTimeout(() => void connect(), 1500)
  }

  const connect = async () => {
    if (!current()) return
    try {
      let page
      let previous
      do {
        previous = cursor
        page = await readRunEventPage(runId, cursor, controller.signal)
        if (!current()) return
        accept(page.events)
      } while (!live() && page.hasMore && cursor > previous)
      if (!current()) return
      onReady?.()
      if (!live()) return

      const connection = new WebSocket(page.streamUrl)
      socket = connection
      connection.onmessage = message => {
        if (!current() || socket !== connection) return
        try {
          const event = readSocketEvent(message.data, runId)
          if (event) accept([event])
          if (terminal) {
            socket = null
            connection.close()
          }
        } catch {
          onError?.('invalid-event')
        }
      }
      connection.onclose = () => {
        if (socket !== connection) return
        socket = null
        reconnect()
      }
    } catch (error) {
      if (!current()) return
      onError?.('unavailable')
      const denied =
        error instanceof ActionResultError && ['unauthenticated', 'forbidden', 'not_found'].includes(error.failure.code)
      if (live() && !denied) reconnect()
    }
  }

  void connect()
  return () => {
    controller.abort()
    clearTimeout(retry)
    const connection = socket
    socket = null
    connection?.close()
  }
}
