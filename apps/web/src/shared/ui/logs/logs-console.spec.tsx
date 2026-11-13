import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LogsConsole } from './logs-console'

describe('LogsConsole', () => {
  it('shows ANSI styles and copies the visible text without terminal controls', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(
      <LogsConsole
        emptyMessage='No logs'
        log={{
          collectedAt: '2026-11-08',
          output: '\u001b[1;32mReady\u001b[0m\r\n\u001b[2K\u001b]8;;https://example.com\u0007<img>\u001b]8;;\u0007'
        }}
      />
    )
    const output = screen.getByLabelText('Log output')
    const ready = within(output).getByText('Ready', { exact: true })
    expect(ready.style.color).not.toBe('')
    expect(ready.style.fontWeight).toBe('bold')
    expect(output.textContent).toBe('Ready\n<img>')
    expect(within(output).queryByRole('link')).not.toBeInTheDocument()
    expect(within(output).queryByRole('img', { hidden: true })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Ready\n<img>'))
  })

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
