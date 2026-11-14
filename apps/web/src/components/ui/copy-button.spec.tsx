import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import { CopyButton } from './copy-button'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
const writeText = vi.fn<(value: string) => Promise<void>>()

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
})
afterEach(() => vi.useRealTimers())

describe('CopyButton', () => {
  it('confirms only a completed write, keeps its text stable, and clears feedback', async () => {
    let finish!: () => void
    const write = new Promise<void>(resolve => {
      finish = resolve
    })
    writeText.mockReturnValue(write)
    render(<CopyButton value='image:latest' />)
    const button = screen.getByRole('button', { name: 'Copy' })
    fireEvent.click(button)
    expect(button).toHaveTextContent('Copy')
    expect(button).toHaveAccessibleName('Copying…')
    expect(button).toBeDisabled()
    expect(screen.queryByText('Copied to clipboard')).toBeNull()
    await act(async () => {
      finish()
      await write
    })
    expect(button).toHaveAccessibleName('Copied')
    expect(button).toHaveTextContent('Copy')
    expect(button).toBeEnabled()
    expect(writeText).toHaveBeenCalledWith('image:latest')
    expect(toast).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    expect(button).toHaveAccessibleName('Copy')
  })

  it('reports denied clipboard access without claiming success and allows retry', async () => {
    vi.useRealTimers()
    writeText.mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(undefined)
    render(<CopyButton value='diagnostic' />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    const retry = await screen.findByRole('button', { name: 'Copy failed. Try again.' })
    expect(retry).toBeEnabled()
    expect(screen.queryByText('Copied to clipboard')).toBeNull()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' }))
    fireEvent.click(retry)
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeEnabled()
  })

  it('ignores a stale clipboard result when the displayed value changes', async () => {
    let finish!: () => void
    const write = new Promise<void>(resolve => {
      finish = resolve
    })
    writeText.mockReturnValue(write)
    const { rerender } = render(<CopyButton value='old' />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    rerender(<CopyButton value='new' />)
    await act(async () => {
      finish()
      await write
    })
    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()
    expect(screen.queryByText('Copied to clipboard')).toBeNull()
  })
})
