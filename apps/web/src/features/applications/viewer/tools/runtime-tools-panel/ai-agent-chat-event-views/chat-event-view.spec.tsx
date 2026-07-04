import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
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
  it('renders public plan events as safe markdown', () => {
    render(<ChatEventView event={event('ai.plan.proposed', '**Plan**\n\n- Open Settings')} />)

    expect(screen.getByText('Plan').tagName.toLowerCase()).toBe('strong')
    expect(screen.getByText('Open Settings').tagName.toLowerCase()).toBe('li')
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
