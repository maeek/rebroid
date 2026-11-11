import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { OrchestratorStatus } from './orchestrator-status'

vi.mock('@/hooks/use-polling-query', () => ({
  usePollingQuery: vi.fn()
}))
vi.mock('@/server/orchestrator/diagnostics/actions', () => ({
  getOrchestratorHealthSummaryAction: vi.fn()
}))

describe('OrchestratorStatus', () => {
  it('polls the shallow diagnostics summary and shows Healthy when services are online', async () => {
    vi.mocked(usePollingQuery).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn()
    })
    vi.mocked(getOrchestratorHealthSummaryAction).mockResolvedValue({
      ok: true,
      docker: true,
      runtime: true,
      display: true,
      firewall: true,
      ocr: true,
      services: {
        orchestrator: { ok: true, status: 'healthy', message: 'Healthy' },
        docker: { ok: true, status: 'healthy', message: 'Healthy' },
        runtime: { ok: true, status: 'healthy', message: 'Healthy' },
        display: { ok: true, status: 'healthy', message: 'Healthy' },
        firewall: { ok: true, status: 'healthy', message: 'Healthy' },
        ocr: { ok: true, status: 'healthy', message: 'Healthy' }
      }
    })

    const { rerender } = render(<OrchestratorStatus />)

    expect(usePollingQuery).toHaveBeenCalledWith('orchestrator:health', expect.any(Function), {
      enabled: true,
      intervalMs: 10_000
    })
    const data = await vi.mocked(usePollingQuery).mock.calls[0]?.[1]()
    expect(getOrchestratorHealthSummaryAction).toHaveBeenCalledTimes(1)

    vi.mocked(usePollingQuery).mockReturnValue({
      data,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn()
    })
    rerender(<OrchestratorStatus />)
    expect(screen.getByRole('button', { name: 'Service status: Healthy' })).toHaveTextContent('Healthy')
  })

  it('links service health rows to their service pages and editors', () => {
    vi.mocked(usePollingQuery).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn()
    })

    render(<OrchestratorStatus />)
    fireEvent.click(screen.getByRole('button', { name: /checking/i }))

    expect(screen.getByRole('link', { name: /casting/i }).getAttribute('href')).toBe(
      '/platform/services/display-sessions'
    )
    expect(screen.getByRole('link', { name: /firewall/i }).getAttribute('href')).toBe(
      '/platform/services?service=firewall'
    )
    expect(screen.getByRole('link', { name: /ocr/i }).getAttribute('href')).toBe('/platform/services?service=ocr')
  })
})
