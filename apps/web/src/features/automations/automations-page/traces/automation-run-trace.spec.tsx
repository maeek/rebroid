import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBff, sendBff } from '@/lib/http/bff'
import { AutomationRunTrace } from './automation-run-trace'
import type { AutomationRun } from '@/shared/contracts/automation'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn(), sendBff: vi.fn() }))

const run: AutomationRun = {
  id: 'run-1',
  automationId: 'workflow-1',
  automationTriggerId: null,
  ownerUserId: 'owner',
  targetApplicationId: 'app',
  targetProfileMode: 'temporary',
  targetProfileName: null,
  trigger: 'manual',
  status: 'running',
  startedAt: '2026-11-01T00:00:00Z',
  completedAt: null,
  stepResults: [],
  error: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z'
}

describe('workflow trace cancellation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getBff).mockImplementation(() => new Promise(() => undefined))
  })

  it('keeps an accepted cancellation pending when the follow-up read fails', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('Temporary read failure'))
    vi.mocked(sendBff).mockResolvedValue(run)
    const { rerender } = render(
      <AutomationRunTrace
        run={run}
        refresh={refresh}
        showTargetId={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(sendBff).toHaveBeenCalledExactlyOnceWith('/api/bff/automations/runs/run-1/cancel', {})
    expect(screen.getByRole('button', { name: 'Stopping…' })).toBeDisabled()
    expect(screen.queryByText('Could not stop the run')).toBeNull()

    rerender(
      <AutomationRunTrace
        run={{ ...run, status: 'canceled' }}
        refresh={refresh}
        showTargetId={false}
      />
    )
    expect(screen.queryByRole('button', { name: /stop/i })).toBeNull()
  })

  it('keeps a previous run’s delayed cancellation response out of the selected run', async () => {
    const pending = Promise.withResolvers<AutomationRun>()
    vi.mocked(sendBff).mockReturnValue(pending.promise)
    const refresh = vi.fn().mockResolvedValue(undefined)
    const view = (id: string) => (
      <AutomationRunTrace
        run={{ ...run, id }}
        refresh={refresh}
        showTargetId={false}
      />
    )
    const { rerender } = render(view('first'))
    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }))
    rerender(view('second'))
    await act(async () => {
      pending.reject(new Error('Unavailable'))
      await pending.promise.catch(() => undefined)
    })
    expect(screen.queryByText('Could not stop the run')).toBeNull()
    expect(screen.getByRole('button', { name: 'Stop run' })).toBeEnabled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('allows retry after a failed stop request', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    vi.mocked(sendBff).mockRejectedValue(new Error('Unavailable'))
    render(
      <AutomationRunTrace
        run={run}
        refresh={refresh}
        showTargetId={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }))
    expect(await screen.findByText('Could not stop the run')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Stop run' })).toBeEnabled()
    expect(refresh).not.toHaveBeenCalled()
  })
})
