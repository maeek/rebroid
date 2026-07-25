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
  it('polls the shallow diagnostics summary', async () => {
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

    render(<OrchestratorStatus />)

    expect(usePollingQuery).toHaveBeenCalledWith('orchestrator:health', expect.any(Function), {
      intervalMs: 10_000
    })
    await vi.mocked(usePollingQuery).mock.calls[0]?.[1]()
    expect(getOrchestratorHealthSummaryAction).toHaveBeenCalledTimes(1)
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
