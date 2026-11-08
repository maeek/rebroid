import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { JsonViewer } from './json-viewer'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

describe('raw resource JSON', () => {
  it('shows complete data immediately and copies the unchanged JSON', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const value = { Name: 'runtime', State: { Running: false }, Count: 3 }
    render(
      <JsonViewer
        title='Raw inspect'
        value={value}
      />
    )
    expect(screen.getByRole('region', { name: 'Raw inspect JSON' }).textContent).toBe(JSON.stringify(value, null, 2))
    expect(screen.getByRole('button', { name: 'Wrap' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Wrap' }))
    expect(screen.getByRole('button', { name: 'Wrap' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify(value, null, 2)))
  })
})
