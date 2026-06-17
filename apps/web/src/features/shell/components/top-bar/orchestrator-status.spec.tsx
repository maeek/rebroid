import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { OrchestratorStatus } from './orchestrator-status'

jest.mock('@/hooks/use-polling-query', () => ({
  usePollingQuery: jest.fn()
}))
jest.mock('@/server/orchestrator/diagnostics/actions', () => ({
  getOrchestratorHealthSummaryAction: jest.fn()
}))

describe('OrchestratorStatus', () => {
  it('polls the shallow diagnostics summary', async () => {
    jest.mocked(usePollingQuery).mockReturnValue({
      data: undefined,
      error: null
    } as never)
    jest.mocked(getOrchestratorHealthSummaryAction).mockResolvedValue({} as never)

    render(<OrchestratorStatus />)

    expect(usePollingQuery).toHaveBeenCalledWith('orchestrator:health', expect.any(Function), {
      intervalMs: 10_000
    })
    await jest.mocked(usePollingQuery).mock.calls[0]?.[1]()
    expect(getOrchestratorHealthSummaryAction).toHaveBeenCalledTimes(1)
  })

  it('links optional service health rows to their service editors', () => {
    jest.mocked(usePollingQuery).mockReturnValue({
      data: undefined,
      error: null
    } as never)

    render(<OrchestratorStatus />)
    fireEvent.click(screen.getByRole('button', { name: /checking/i }))

    expect(screen.getByRole('link', { name: /firewall/i }).getAttribute('href')).toBe(
      '/platform/services?service=firewall'
    )
    expect(screen.getByRole('link', { name: /ocr/i }).getAttribute('href')).toBe('/platform/services?service=ocr')
  })
})
