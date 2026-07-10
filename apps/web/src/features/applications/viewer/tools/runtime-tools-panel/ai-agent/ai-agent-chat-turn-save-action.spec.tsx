import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChatTurnSaveWorkflowAction } from './ai-agent-chat-turn-save-action'
import type { ChatTurn } from './ai-agent-chat-utils'

const turn = {
  id: 'turn-1',
  prompt: 'Open Settings',
  status: 'success',
  run: {
    id: 'run-1',
    automationId: 'automation-1',
    automationTriggerId: null,
    ownerUserId: 'owner-1',
    targetApplicationId: 'app-1',
    targetProfileMode: null,
    targetProfileName: null,
    trigger: 'manual',
    status: 'success',
    startedAt: null,
    completedAt: null,
    stepResults: [],
    error: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  events: [
    {
      id: 'event-1',
      runId: 'run-1',
      ownerUserId: 'owner-1',
      sequence: 1,
      type: 'ai.message.completed',
      stepId: null,
      parentStepId: null,
      message: 'Settings is open.',
      data: {},
      createdAt: '2026-01-01T00:00:01.000Z'
    }
  ]
} satisfies ChatTurn

describe('ChatTurnSaveWorkflowAction', () => {
  it('copies the final response and keeps workflow drafting available', async () => {
    const writeText = jest.fn<(value: string) => Promise<void>>(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const onSaveWorkflow = jest.fn()
    render(
      <ChatTurnSaveWorkflowAction
        turn={turn}
        onSaveWorkflow={onSaveWorkflow}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Settings is open.'))
    expect(await screen.findByRole('button', { name: 'Copied' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Save as workflow' }))
    expect(onSaveWorkflow).toHaveBeenCalledWith(turn)
  })
})
