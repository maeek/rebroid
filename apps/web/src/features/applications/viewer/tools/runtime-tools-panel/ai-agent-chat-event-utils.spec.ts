import { beforeEach, describe, expect, it } from '@jest/globals'
import { buildTimelineItems } from './ai-agent-chat-event-utils'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

let eventSequence = 0

const event = (type: string, override: Partial<AutomationRunEvent> = {}): AutomationRunEvent => ({
  id: `event-${eventSequence++}`,
  runId: 'run',
  ownerUserId: 'owner',
  sequence: 0,
  type: type as AutomationRunEvent['type'],
  stepId: null,
  parentStepId: null,
  message: type,
  data: {},
  createdAt: '2020-01-01T00:00:00.000Z',
  ...override
})

describe('buildTimelineItems', () => {
  beforeEach(() => {
    eventSequence = 0
  })

  it('coalesces matching ai tool events into a single tool item', () => {
    const events: AutomationRunEvent[] = [
      event('ai.tool.arguments', {
        id: 'a1',
        data: { uses: 'tool.one', arguments: { count: 1 } }
      }),
      event('ai.tool.completed', {
        id: 'a2',
        data: { uses: 'tool.one', output: { result: 'ok' } }
      }),
      event('ai.message.completed', { id: 'a3', message: 'done' })
    ]

    const timeline = buildTimelineItems(events)

    expect(timeline).toHaveLength(2)
    expect(timeline[0]).toMatchObject({
      type: 'tool',
      name: 'tool.one',
      status: 'used'
    })
    expect(timeline[0]).toHaveProperty('arguments.0.key', 'count')
    expect(timeline[1]).toMatchObject({
      type: 'event',
      event: {
        id: 'a3',
        type: 'ai.message.completed'
      }
    })
  })

  it('flushes a tool when a new one starts', () => {
    const events: AutomationRunEvent[] = [
      event('ai.tool.arguments', {
        id: 'a1',
        data: { uses: 'tool.one', arguments: { count: 1 } }
      }),
      event('ai.tool.arguments', {
        id: 'a2',
        data: { uses: 'tool.two', arguments: { size: 2 } }
      }),
      event('ai.tool.completed', {
        id: 'a3',
        data: { uses: 'tool.two', output: { ok: true } }
      })
    ]

    const timeline = buildTimelineItems(events)

    expect(timeline).toHaveLength(2)
    expect(timeline[0]).toMatchObject({
      type: 'tool',
      name: 'tool.one',
      status: 'using'
    })
    expect(timeline[1]).toMatchObject({
      type: 'tool',
      name: 'tool.two',
      status: 'used'
    })
  })
})
