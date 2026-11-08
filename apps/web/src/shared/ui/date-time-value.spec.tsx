import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DateTimeValue } from './date-time-value'

describe('date and time precision', () => {
  it('preserves audit seconds and exact timestamp while using a single readable date', () => {
    render(
      <DateTimeValue
        value='2026-11-08T09:17:19.369Z'
        showSeconds
      />
    )
    const time = screen.getByLabelText(/2026/)
    expect(time).toHaveTextContent(/\d{2}:\d{2}:19/)
    expect(time).toHaveAttribute('datetime', '2026-11-08T09:17:19.369Z')
    expect(time).toHaveAccessibleName(time.getAttribute('title')!)
  })

  it('keeps the compact existing minute precision by default', () => {
    render(
      <DateTimeValue
        value='2026-11-08T09:17:19.369Z'
        compact
      />
    )
    expect(screen.getByText(/8 Nov 2026 ·/)).toHaveTextContent(/· \d{2}:\d{2}$/)
  })
})
