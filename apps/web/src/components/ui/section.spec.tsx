import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorFormContext } from './editor-form-context'
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

  it.each([
    ['none', 'pb-0'],
    ['compact', 'pb-2'],
    ['default', 'pb-4']
  ] as const)('applies %s heading spacing', (headingSpacing, expectedClassName) => {
    render(
      <Section
        title='Spacing'
        headingSpacing={headingSpacing}
        surface='plain'
      >
        Content
      </Section>
    )

    expect(screen.getByTestId('section-heading')).toHaveClass(expectedClassName)
  })
  it('renders helper copy in a named region without adding a heading', () => {
    render(
      <Section
        surface='plain'
        aria-label='Resource quotas'
        description='Set limits for applications and sessions.'
      >
        Content
      </Section>
    )

    const region = screen.getByRole('region', { name: 'Resource quotas' })
    expect(region).toHaveTextContent('Set limits for applications and sessions.')
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('retains draft values while collapsed and reveals validation errors', async () => {
    const { rerender } = render(
      <EditorFormContext.Provider value={true}>
        <Section
          title='Advanced'
          surface='plain'
          collapsible
        >
          <input
            aria-label='Limit'
            defaultValue='42'
          />
        </Section>
      </EditorFormContext.Provider>
    )
    const control = screen.getByLabelText('Limit')
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(control, { target: { value: '64' } })
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    rerender(
      <EditorFormContext.Provider value={true}>
        <Section
          title='Advanced'
          surface='plain'
          collapsible
        >
          <input
            aria-label='Limit'
            defaultValue='42'
            aria-invalid='true'
          />
        </Section>
      </EditorFormContext.Provider>
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-expanded', 'true')
    )
    expect(control).toHaveValue('64')
  })
})
