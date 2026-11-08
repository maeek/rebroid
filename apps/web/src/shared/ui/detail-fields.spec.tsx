import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DetailFields } from '@/shared/ui/detail-fields'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
describe('diagnostic values', () => {
  it('keeps complete technical values readable and copies their exact contents', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const value = 'androidboot.redroid_width=1080 androidboot.redroid_height=2340\nandroidboot.redroid_fps=60'
    render(
      <DetailFields
        title='Container'
        fields={[{ label: 'Container arguments', value, copyValue: value, code: true, fullWidth: true }]}
      />
    )
    expect(screen.getByText(value, { exact: true, normalizer: text => text })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Copy Container arguments' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(value))
  })
})
