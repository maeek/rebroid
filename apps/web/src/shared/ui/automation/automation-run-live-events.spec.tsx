import { describe, expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import {
  cancelAutomationRunAction,
  createAutomationRunEventStreamUrlAction,
  listAutomationRunEventsAction
} from '@/server/orchestrator/automations/automation-run-actions'
import { AutomationRunLiveEvents } from './automation-run-live-events'
import type { AutomationRun, AutomationRunEvent } from '@/server/orchestrator/automations/types'

jest.mock('@/server/orchestrator/automations/automation-run-actions', () => ({
  cancelAutomationRunAction: jest.fn(),
  createAutomationRunEventStreamUrlAction: jest.fn(),
  listAutomationRunEventsAction: jest.fn()
}))

const run: AutomationRun = {
  id: 'run_1234567890',
  automationId: 'automation_1',
  automationTriggerId: null,
  ownerUserId: 'user_1',
  targetApplicationId: 'app_1',
  targetProfileMode: 'temporary',
  targetProfileName: null,
  trigger: 'manual',
  status: 'queued',
  startedAt: null,
  completedAt: null,
  stepResults: [],
  error: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

const failedEvent: AutomationRunEvent = {
  id: 'event_1',
  runId: run.id,
  ownerUserId: 'user_1',
  sequence: 1,
  type: 'run.failed',
  stepId: null,
  parentStepId: null,
  message: 'Provider returned an invalid decision.',
  data: {},
  createdAt: '2026-01-01T00:00:01.000Z'
}

describe('AutomationRunLiveEvents', () => {
  it('removes Stop and avoids opening a live socket after replay reaches a terminal status', async () => {
    jest.mocked(listAutomationRunEventsAction).mockResolvedValue([failedEvent])
    jest.mocked(createAutomationRunEventStreamUrlAction).mockResolvedValue('ws://example.test/events')
    jest.mocked(cancelAutomationRunAction).mockResolvedValue({ ...run, status: 'canceled' })

    render(<AutomationRunLiveEvents run={run} />)

    expect(await screen.findByText('Failed')).toBeTruthy()
    expect(screen.getByText('Provider returned an invalid decision.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Stop automation run' })).toBeNull()
    expect(createAutomationRunEventStreamUrlAction).not.toHaveBeenCalled()
  })
})
