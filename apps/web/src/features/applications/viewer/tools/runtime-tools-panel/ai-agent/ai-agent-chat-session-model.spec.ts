import { describe, expect, it } from '@jest/globals'
import {
  collectLatestRunSequences,
  createPromptTurn,
  findActiveHistoryTurnId,
  findTerminalRunStatus,
  latestEventSequence,
  mergeHistoryTurns,
  mergeRunEventsIntoTurns,
  sortChatTurnsByRunCreatedAt
} from './ai-agent-chat-session-model'
import type { ChatTurn } from './ai-agent-chat-utils'
import type { AutomationRun, AutomationRunEvent } from '@/server/orchestrator/automations/types'

const run = (override: Partial<AutomationRun> = {}): AutomationRun => ({
  id: 'run-1',
  automationId: 'automation',
  automationTriggerId: null,
  ownerUserId: 'owner',
  targetApplicationId: 'app',
  targetProfileMode: null,
  targetProfileName: null,
  trigger: 'manual',
  status: 'running',
  startedAt: null,
  completedAt: null,
  stepResults: [],
  error: null,
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
  ...override
})

const event = (override: Partial<AutomationRunEvent> = {}): AutomationRunEvent => ({
  id: 'event-1',
  runId: 'run-1',
  ownerUserId: 'owner',
  sequence: 1,
  type: 'heartbeat',
  stepId: null,
  parentStepId: null,
  message: '',
  data: {},
  createdAt: '2020-01-01T00:00:00.000Z',
  ...override
})

const turn = (override: Partial<ChatTurn> = {}): ChatTurn => ({
  id: 'turn-1',
  prompt: 'Prompt',
  status: 'running',
  run: run(),
  events: [],
  ...override
})

describe('ai agent chat session model', () => {
  it('sorts loaded run turns by run creation time', () => {
    const turns = [
      turn({ id: 'second', run: run({ id: 'run-2', createdAt: '2020-01-02T00:00:00.000Z' }) }),
      turn({ id: 'first', run: run({ id: 'run-1', createdAt: '2020-01-01T00:00:00.000Z' }) })
    ]

    expect(sortChatTurnsByRunCreatedAt(turns).map(item => item.id)).toEqual(['first', 'second'])
  })

  it('collects latest event sequence by run', () => {
    const sequences = collectLatestRunSequences([
      turn({ run: run({ id: 'run-1' }), events: [event({ sequence: 2 }), event({ sequence: 5 })] }),
      turn({ run: run({ id: 'run-2' }), events: [event({ runId: 'run-2', sequence: 3 })] }),
      turn({ run: null, events: [event({ sequence: 100 })] })
    ])

    expect([...sequences]).toEqual([
      ['run-1', 5],
      ['run-2', 3]
    ])
  })

  it('keeps local draft turns while replacing history by run id', () => {
    const draft = turn({ id: 'draft', run: null })
    const stale = turn({ id: 'stale', run: run({ id: 'run-1' }), prompt: 'Old' })
    const fresh = turn({ id: 'fresh', run: run({ id: 'run-1' }), prompt: 'New' })

    expect(mergeHistoryTurns([draft, stale], [fresh])).toEqual([draft, fresh])
  })

  it('finds the latest active history turn', () => {
    const activeTurnId = findActiveHistoryTurnId([
      turn({ id: 'old-active', run: run({ id: 'run-1', status: 'running' }) }),
      turn({ id: 'done', run: run({ id: 'run-2', status: 'success' }) }),
      turn({ id: 'new-active', run: run({ id: 'run-3', status: 'queued' }) })
    ])

    expect(activeTurnId).toBe('new-active')
  })

  it('deduplicates run events and projects terminal status', () => {
    const updated = mergeRunEventsIntoTurns(
      [
        turn({
          status: 'running',
          run: run({ id: 'run-1', status: 'running' }),
          events: [event({ id: 'event-1', sequence: 2, message: 'old' })]
        })
      ],
      'run-1',
      [
        event({ id: 'event-2', sequence: 1 }),
        event({ id: 'event-1', sequence: 2, type: 'run.completed', message: 'new' })
      ]
    )

    expect(updated[0]).toMatchObject({
      status: 'success',
      run: { status: 'success' },
      events: [{ id: 'event-2' }, { id: 'event-1', message: 'new' }]
    })
  })

  it('detects terminal status and latest sequence', () => {
    expect(findTerminalRunStatus([event({ type: 'run.started' }), event({ type: 'run.failed' })])).toBe('failed')
    expect(latestEventSequence(7, [event({ sequence: 5 }), event({ sequence: 9 })])).toBe(9)
    expect(latestEventSequence(7, [])).toBe(7)
  })

  it('creates prompt turns with queued state only when another turn is active', () => {
    expect(createPromptTurn({ id: 'turn', prompt: 'Go', hasActiveTurn: false })).toMatchObject({
      id: 'turn',
      status: 'starting'
    })
    expect(createPromptTurn({ id: 'turn', prompt: 'Go', hasActiveTurn: true })).toMatchObject({
      id: 'turn',
      status: 'queued'
    })
  })
})
