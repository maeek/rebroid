import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NumberSliderField } from '@/components/ui/number-slider-field'

vi.mock('@/lib/safe-vibrate', () => ({
  safeVibrate: vi.fn()
}))

describe('NumberSliderField', () => {
  it('clamps numeric input on blur', () => {
    const onValueChange = vi.fn()

    render(
      <NumberSliderField
        value='999'
        onValueChange={onValueChange}
        min={1}
        max={32}
        rangeLabel='Bitrate range'
      />
    )

    fireEvent.blur(screen.getByRole('spinbutton'))
    expect(onValueChange).toHaveBeenCalledWith('32')
  })

  it('preserves min/max labels and range accessibility label', () => {
    render(
      <NumberSliderField
        value='15'
        onValueChange={vi.fn()}
        min={1}
        max={32}
        suffix=' Mbps'
        rangeLabel='Bitrate range'
      />
    )

    expect(screen.getByText('1 Mbps')).toBeTruthy()
    expect(screen.getByText('32 Mbps')).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Bitrate range' })).toBeTruthy()
  })

  it('keeps numeric bounds without rendering a slider when disabled', () => {
    const onValueChange = vi.fn()

    render(
      <NumberSliderField
        value='999'
        onValueChange={onValueChange}
        min={8}
        max={128}
        showSlider={false}
      />
    )

    expect(screen.queryByRole('slider')).toBeNull()
    fireEvent.blur(screen.getByRole('spinbutton'))
    expect(onValueChange).toHaveBeenCalledWith('128')
  })
})
