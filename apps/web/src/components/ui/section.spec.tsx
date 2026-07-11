import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Section } from './section'

describe('Section', () => {
  it.each([
    ['Plain', 'plain'],
    ['Band', 'band'],
    ['Panel', 'panel']
  ] as const)('renders the %s surface', (title, surface) => {
    render(
      <Section
        title={title}
        surface={surface}
      >
        Content
      </Section>
    )

    expect(screen.getByRole('region', { name: title }).getAttribute('data-surface')).toBe(surface)
  })
})
