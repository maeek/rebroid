import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getBff, sendBff } from '@/lib/http/bff'
import { AutomationRunLiveEvents } from './automation-run-live-events'
import type { AutomationRun, AutomationRunEvent } from '@/shared/contracts/automation'

vi.mock('@/lib/http/bff', () => ({
  getBff: vi.fn(),
  sendBff: vi.fn()
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
  it('shows the OCR request and response for the selected step occurrence', async () => {
    const exchange: AutomationRunEvent = {
      ...failedEvent,
      type: 'vision.ocr.exchange',
      stepId: 'locate',
      message: 'OCR returned 1 text box(es).',
      data: {
        path: 'steps[0].iterations[2].steps[0]',
        request: { language: 'pl', timeoutMs: 500 },
        response: { httpStatus: 200, detections: [{ text: 'Żappka' }] },
        preview: { dataUrl: 'data:image/jpeg;base64,/9j/2Q==', width: 1, height: 1 }
      }
    }
    vi.mocked(getBff).mockResolvedValue({
      events: [
        exchange,
        {
          ...exchange,
          id: 'event_2',
          sequence: 2,
          message: 'Another iteration',
          data: { path: 'steps[0].iterations[3].steps[0]' }
        }
      ],
      streamUrl: 'ws://example.test/events'
    })
    const clear = vi.fn()
    render(
      <AutomationRunLiveEvents
        run={{ ...run, status: 'success' }}
        presentation='flat'
        ocrStep={{ stepId: 'locate', path: 'steps[0].iterations[2].steps[0]' }}
        onClearOcrStep={clear}
      />
    )

    fireEvent.click(await screen.findByText(exchange.message))
    expect(await screen.findByText('OCR request')).toBeTruthy()
    expect(screen.getByText('OCR response')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Android screenshot sent for text recognition' })).toBeTruthy()
    expect(screen.queryByText('Another iteration')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show all events' }))
    expect(clear).toHaveBeenCalledOnce()
  })

  it('removes Stop and avoids opening a live socket after replay reaches a terminal status', async () => {
    vi.mocked(getBff).mockResolvedValue({ events: [failedEvent], streamUrl: 'ws://example.test/events' })
    vi.mocked(sendBff).mockResolvedValue({ ...run, status: 'canceled' })

    render(<AutomationRunLiveEvents run={run} />)

    expect(await screen.findByText('Failed')).toBeTruthy()
    expect(screen.getByText('Provider returned an invalid decision.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Stop automation run' })).toBeNull()
    expect(sendBff).not.toHaveBeenCalled()
  })
  it('describes missing historical events without suggesting a completed run is still active', async () => {
    vi.mocked(getBff).mockResolvedValue({ events: [], streamUrl: 'ws://example.test/events' })
    render(
      <AutomationRunLiveEvents
        run={{ ...run, status: 'failed' }}
        allowCancel={false}
      />
    )
    expect(await screen.findByText('No recorded events')).toBeTruthy()
    expect(screen.queryByText('Waiting for activity')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stop automation run' })).toBeNull()
  })
  it('reads every page of a recorded run using the last delivered sequence', async () => {
    vi.mocked(getBff)
      .mockResolvedValueOnce({
        events: [{ ...failedEvent, sequence: 1000, type: 'step.completed', message: 'First page step' }],
        hasMore: true,
        streamUrl: 'ws://example.test/events'
      })
      .mockResolvedValueOnce({
        events: [{ ...failedEvent, id: 'event_terminal', sequence: 1001 }],
        hasMore: false,
        streamUrl: 'ws://example.test/events'
      })
    render(<AutomationRunLiveEvents run={{ ...run, status: 'failed' }} />)

    expect(await screen.findByText(failedEvent.message)).toBeTruthy()
    expect(screen.getByText('First page step')).toBeTruthy()
    expect(getBff).toHaveBeenLastCalledWith(
      `/api/bff/automations/runs/${run.id}/events?after=1000`,
      expect.any(AbortSignal)
    )
  })
  it('preserves the recorded terminal status while replaying earlier events', async () => {
    vi.mocked(getBff).mockResolvedValue({
      events: [{ ...failedEvent, type: 'run.started', message: 'Earlier start event' }],
      streamUrl: 'ws://example.test/events'
    })
    render(<AutomationRunLiveEvents run={{ ...run, status: 'failed' }} />)
    expect(await screen.findByText('Earlier start event')).toBeTruthy()
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Stop automation run' })).toBeNull()
  })
})
