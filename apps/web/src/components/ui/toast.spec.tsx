import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { toast } from '@/hooks/use-toast'
import { Toaster } from './toaster'

describe('Toast', () => {
  it('coalesces identical notices and keeps dismissal available', async () => {
    render(<Toaster />)
    act(() => {
      toast({ title: 'Connection unavailable', variant: 'danger', timeout: 0 })
      toast({ title: 'Connection unavailable', variant: 'danger', timeout: 0 })
    })
    expect(screen.getAllByText('Connection unavailable')).toHaveLength(1)
    const close = await screen.findByRole('button', { name: 'Close' })
    expect(close).not.toHaveClass('opacity-0')
    fireEvent.click(close)
  })

  it('keeps its identity when updated and dismissed', async () => {
    render(<Toaster />)
    let notice: ReturnType<typeof toast>
    act(() => {
      notice = toast({ title: 'Preparing', timeout: 0 })
    })
    act(() => {
      notice.update({ title: 'Ready', variant: 'success', timeout: 0 })
    })
    expect(screen.queryByText('Preparing')).toBeNull()
    expect(screen.getByText('Ready')).toBeTruthy()
    act(() => {
      notice.dismiss()
    })
    await waitFor(() => expect(screen.queryByText('Ready')).toBeNull())
  })

  it('uses the authoritative success surface tone', () => {
    render(<Toaster />)
    act(() => {
      toast({ title: 'Saved', variant: 'success', timeout: 0 })
    })

    const toastElement = screen.getByTestId('toast-success')
    expect(toastElement).toHaveAttribute('data-tone', 'success')
    expect(toastElement).toHaveClass('data-[tone=success]:!bg-success/14')
  })
})
