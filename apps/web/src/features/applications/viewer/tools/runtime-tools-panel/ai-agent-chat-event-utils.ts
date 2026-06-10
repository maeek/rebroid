import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

export type CompactValueRow = {
  key: string
  value: string
}

export type ToolTimelineItem = {
  type: 'tool'
  key: string
  name: string
  status: 'using' | 'used' | 'failed'
  arguments: CompactValueRow[]
  output: CompactValueRow[]
  error: string | null
}

export type EventTimelineItem =
  | {
      type: 'event'
      event: AutomationRunEvent
    }
  | ToolTimelineItem

export const compactValue = (value: unknown) => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value) ?? '[unserializable]'
  } catch {
    return Object.prototype.toString.call(value)
  }
}

export const compactValueRows = (value: unknown): CompactValueRow[] => {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item, index) => {
      const text = compactValue(item)
      return {
        key: `item ${index + 1}`,
        value: text.length > 180 ? `${text.slice(0, 180)}...` : text
      }
    })
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .slice(0, 12)
      .map(([key, item]) => {
        const text = compactValue(item)
        return {
          key,
          value: text.length > 180 ? `${text.slice(0, 180)}...` : text
        }
      })
  }
  return [
    {
      key: 'value',
      value: compactValue(value)
    }
  ]
}

export const compactArgumentRows = compactValueRows

export const isToolEvent = (event: AutomationRunEvent) =>
  event.type === 'ai.tool.arguments' ||
  event.type === 'ai.tool.started' ||
  event.type === 'ai.tool.completed' ||
  event.type === 'ai.tool.failed'

const eventToolName = (event: AutomationRunEvent) =>
  typeof event.data.uses === 'string' ? event.data.uses : event.message

export const buildTimelineItems = (events: AutomationRunEvent[]): EventTimelineItem[] => {
  const items: EventTimelineItem[] = []
  let pendingTool: ToolTimelineItem | null = null

  const flushTool = () => {
    if (!pendingTool) return
    items.push(pendingTool)
    pendingTool = null
  }

  for (const event of events) {
    if (!isToolEvent(event)) {
      flushTool()
      items.push({ type: 'event', event })
      continue
    }

    const name = eventToolName(event)
    if (pendingTool && pendingTool.name !== name) {
      flushTool()
    }

    pendingTool ??= {
      type: 'tool',
      key: event.id,
      name,
      status: 'using',
      arguments: [],
      output: [],
      error: null
    }

    if (event.type === 'ai.tool.arguments') {
      pendingTool.arguments = compactArgumentRows(event.data.arguments)
    }

    if (event.type === 'ai.tool.completed') {
      pendingTool.status = 'used'
      pendingTool.output = compactArgumentRows(event.data.output !== undefined ? event.data.output : event.data)
      flushTool()
    }

    if (event.type === 'ai.tool.failed') {
      pendingTool.status = 'failed'
      pendingTool.error = event.message
      flushTool()
    }
  }

  flushTool()
  return items
}
