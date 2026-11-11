import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getBff } from '@/lib/http/bff'
import { CastingSidecarLogs } from './casting-sidecar-logs'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))

describe('CastingSidecarLogs', () => {
  it('requests logs only after opening the dialog and fetches the larger tail on demand', async () => {
    vi.mocked(getBff)
      .mockResolvedValueOnce({ output: 'newest line', lineLimit: 20, truncated: true })
      .mockResolvedValueOnce({ output: 'older line\nnewest line', lineLimit: 200, truncated: false })
      .mockResolvedValueOnce({ output: 'newest line', lineLimit: 20, truncated: true })
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CastingSidecarLogs
          disabled={false}
          revision={0}
        />
      </QueryClientProvider>
    )

    expect(getBff).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'View logs' }))

    expect(screen.getByRole('dialog', { name: 'Display sidecar logs' })).toBeVisible()
    const output = await screen.findByRole('region', { name: 'Display sidecar log output' })
    const expand = screen.getByRole('button', { name: 'Show more logs' })
    expect(getBff).toHaveBeenCalledTimes(1)
    expect(getBff).toHaveBeenCalledWith(
      '/api/bff/platform/display-sidecar/logs?expanded=false',
      expect.any(AbortSignal)
    )
    expect(output).toHaveClass('whitespace-pre', 'overflow-auto')
    expect(output.textContent).toBe('newest line')

    fireEvent.click(expand)

    const collapse = await screen.findByRole('button', { name: 'Show preview' })
    expect(getBff).toHaveBeenLastCalledWith(
      '/api/bff/platform/display-sidecar/logs?expanded=true',
      expect.any(AbortSignal)
    )
    expect(output.textContent).toBe('older line\nnewest line')
    fireEvent.click(collapse)
    await waitFor(() => expect(output.textContent).toBe('newest line'))
    expect(getBff).toHaveBeenCalledTimes(3)
  })
})
