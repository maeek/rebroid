import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { toast } from '@/hooks/use-toast'
import { Toaster } from './toaster'

describe('Toast', () => {
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
