import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Surface } from './surface'

describe('Surface', () => {
  it('keeps semantic success styling authoritative over its level background', () => {
    render(
      <Surface
        level='panel'
        tone='success'
      >
        Ready
      </Surface>
    )

    const surface = screen.getByText('Ready')
    expect(surface).toHaveAttribute('data-tone', 'success')
    expect(surface).toHaveClass('data-[tone=success]:!bg-success/14')
    expect(surface).toHaveClass('data-[tone=success]:!border-success/45')
  })
})
