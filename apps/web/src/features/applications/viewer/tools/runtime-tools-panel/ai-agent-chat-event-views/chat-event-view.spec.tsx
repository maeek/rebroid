import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'
import { ChatEventView } from './chat-event-view'

const event = (type: AutomationRunEvent['type'], message: string): AutomationRunEvent => ({
  id: `event-${type}`,
  runId: 'run',
  ownerUserId: 'owner',
  sequence: 1,
  type,
  stepId: null,
  parentStepId: null,
  message,
  data: {},
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
})
