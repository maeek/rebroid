import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { NumberSliderField } from '@/components/ui/number-slider-field'

jest.mock('@/lib/safe-vibrate', () => ({
  safeVibrate: jest.fn()
}))

describe('NumberSliderField', () => {
  it('clamps numeric input on blur', () => {
    const onValueChange = jest.fn()

    render(
      <NumberSliderField
        value='99'
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
        onValueChange={jest.fn()}
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
})
