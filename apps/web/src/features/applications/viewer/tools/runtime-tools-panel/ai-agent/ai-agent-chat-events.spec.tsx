import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ChatTurnView } from './ai-agent-chat-events'
import type { AutomationRunEvent } from '@/shared/contracts/automation'

function event(
  sequence: number,
  type: AutomationRunEvent['type'],
  message: string,
  data: Record<string, unknown> = {}
): AutomationRunEvent {
  return {
    id: `event-${sequence}`,
    sequence,
    type,
    message,
    data,
    runId: 'run',
    ownerUserId: 'owner',
    stepId: null,
    parentStepId: null,
    createdAt: '2026-11-14T10:00:00.000Z'
  }
}

it('links the result only to observations cited by the verified completion event', () => {
  render(
    <ChatTurnView
      turn={{
        id: 'turn',
        prompt: 'Check Settings',
        status: 'success',
        run: null,
        events: [
          event(1, 'ai.perception.observed', 'Initial capture', { snapshotId: 'home' }),
          event(2, 'ai.perception.observed', 'Settings capture', { snapshotId: 'settings', width: 400, height: 800 }),
          event(3, 'ai.message.completed', 'Settings verified.', {
            completed: true,
            evidenceIds: ['snapshot:missing', 'action:1'],
            observationIds: ['settings', 'settings']
          })
        ]
      }}
    />
  )

  expect(screen.getByText('Settings verified.')).toBeVisible()
  expect(screen.getByText('Initial capture')).not.toBeVisible()
  const link = screen.getByRole('link', { name: 'Observation 1' })
  expect(screen.getAllByRole('link', { name: /Observation/ })).toHaveLength(1)
  const scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
  try {
    fireEvent.click(link)
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
  expect(screen.getByText('Settings capture')).toBeVisible()
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
})

it('shows a blocked result without treating its observations as verified completion', () => {
  render(
    <ChatTurnView
      turn={{
        id: 'turn',
        prompt: 'Check Settings',
        status: 'success',
        run: null,
        events: [
          event(1, 'ai.perception.observed', 'Initial capture', { snapshotId: 'home' }),
          event(2, 'ai.message.completed', 'Could not open Settings.', {
            status: 'blocked',
            completed: false,
            evidenceIds: ['snapshot:home']
          })
        ]
      }}
    />
  )
  expect(screen.getByText('Blocked', { exact: true })).toBeVisible()
  expect(screen.getByText('Could not open Settings.')).toBeVisible()
  expect(screen.queryByText('Verified observations')).toBeNull()
})
