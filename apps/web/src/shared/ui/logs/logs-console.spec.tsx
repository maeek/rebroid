import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LogsConsole } from './logs-console'

describe('LogsConsole', () => {
  it('preserves refresh controls and keeps following output opt-in', () => {
    const refresh = vi.fn()
    const { rerender } = render(
      <LogsConsole
        emptyMessage='No logs'
        onRefresh={refresh}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled()
    const output = screen.getByLabelText('Log output')
    Object.defineProperty(output, 'scrollHeight', { configurable: true, value: 480 })
    rerender(
      <LogsConsole
        emptyMessage='No logs'
        log={{ collectedAt: '2026-11-08', output: 'first' }}
      />
    )
    expect(output.scrollTop).toBe(0)
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()
    rerender(
      <LogsConsole
        emptyMessage='No logs'
        followOutput
        log={{ collectedAt: '2026-11-08', output: 'second' }}
      />
    )
    expect(output.scrollTop).toBe(480)
    output.scrollTop = 12
    rerender(
      <LogsConsole
        emptyMessage='No logs'
        log={{ collectedAt: '2026-11-08', output: 'third' }}
      />
    )
    expect(output.scrollTop).toBe(12)
  })
})
