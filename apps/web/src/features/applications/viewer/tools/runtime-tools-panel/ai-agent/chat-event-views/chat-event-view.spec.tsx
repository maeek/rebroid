import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatEventView } from './chat-event-view'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

const event = (
  type: AutomationRunEvent['type'],
  message: string,
  data: Record<string, unknown> = {}
): AutomationRunEvent => ({
  id: `event-${type}`,
  runId: 'run',
  ownerUserId: 'owner',
  sequence: 1,
  type,
  stepId: null,
  parentStepId: null,
  message,
  data,
  createdAt: '2020-01-01T00:00:00.000Z'
})

describe('ChatEventView', () => {
  it('renders a safe reasoning summary from generation metadata', () => {
    render(
      <ChatEventView
        event={event('ai.model.completed', 'Controller turn completed.', {
          reasoningPresent: true,
          usage: { completionTokens: 20 }
        })}
      />
    )

    expect(screen.getByText('Reasoned about the next step')).not.toBeNull()
    expect(screen.getByText(/20 output tokens/)).not.toBeNull()
  })

  it('offers one-run approval for allowlisted escalation requests', () => {
    const onApproveEscalation = jest.fn()
    render(
      <ChatEventView
        event={event('ai.guardrail.triggered', 'Raw ADB shell is disabled for this run.', {
          program: 'getprop'
        })}
        onApproveEscalation={onApproveEscalation}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Allow once' }))

    expect(onApproveEscalation).toHaveBeenCalledWith('getprop')
    expect(screen.getByText('Approval queued as a follow-up.')).not.toBeNull()
  })

  it('renders orientation and action decisions as compact status text', () => {
    render(<ChatEventView event={event('ai.action.decided', 'Next action: open Settings.')} />)

    expect(screen.getByText('Next action: open Settings.')).not.toBeNull()
  })

  it('collapses perception details by default', () => {
    render(
      <ChatEventView
        event={event('ai.perception.observed', 'Screen captured: UI hierarchy failed. OCR failed, 0 text box(es).', {
          uiStatus: 'failed',
          uiError: 'UI hierarchy dump failed.',
          ocrStatus: 'failed',
          ocrTextCount: 0,
          ocrError: 'OCR execution failed.',
          screenKind: 'home',
          width: 1080,
          height: 2340,
          visibleText: ['Google', 'Gallery'],
          visualAffordances: 'Screen hypothesis: home.'
        })}
      />
    )

    expect(screen.getByTestId('perception-disclosure').hasAttribute('open')).toBe(false)
    expect(screen.getByText('Inspected screen')).not.toBeNull()
    expect(screen.getByText(/UI failed .* OCR failed .* vision: home/)).not.toBeNull()
  })
})
