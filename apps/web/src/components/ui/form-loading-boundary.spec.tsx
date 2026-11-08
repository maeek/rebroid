import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './form-field'
import { FormLoadingBoundary } from './form-loading-boundary'
import { Input } from './input'

const Field = () => (
  <FormField
    label='Name'
    description='Name shown throughout the console.'
    layout='vertical'
  >
    <Input
      value='Private draft'
      readOnly
    />
  </FormField>
)

describe('form loading boundary', () => {
  it('retains labels and descriptions while making draft controls hidden and inert', () => {
    render(
      <FormLoadingBoundary>
        <Field />
      </FormLoadingBoundary>
    )
    expect(screen.getByText('Name')).toBeVisible()
    expect(screen.getByText('Name shown throughout the console.')).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('restores the associated, usable input when loading completes', () => {
    const { rerender } = render(
      <FormLoadingBoundary>
        <Field />
      </FormLoadingBoundary>
    )
    rerender(<Field />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toBeVisible()
    expect(input).toHaveAccessibleDescription('Name shown throughout the console.')
  })
})
