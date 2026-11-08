import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './form-field'
import { Input } from './input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

describe('FormField associations', () => {
  it('preserves a control identifier and existing guidance while adding field descriptions and errors', () => {
    render(
      <>
        <p id='unit-help'>Seconds, from 1 to 60.</p>
        <FormField
          label='Timeout'
          description='Wait before retrying.'
          error='Choose a valid timeout.'
          layout='vertical'
        >
          <Input
            id='timeout'
            aria-describedby='unit-help'
            aria-invalid='grammar'
          />
        </FormField>
      </>
    )
    const input = screen.getByRole('textbox', { name: 'Timeout' })
    expect(input).toHaveAttribute('id', 'timeout')
    expect(input).toHaveAccessibleDescription('Seconds, from 1 to 60. Wait before retrying. Choose a valid timeout.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('associates labels and validation with the actual compound select trigger', () => {
    render(
      <FormField
        label='Connection'
        description='Choose a provider.'
        error='Connection required.'
        layout='vertical'
      >
        <Select value='local'>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='local'>Local</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    )
    expect(screen.getByRole('combobox', { name: 'Connection' })).toHaveAccessibleDescription(
      'Choose a provider. Connection required.'
    )
    expect(screen.getByRole('combobox', { name: 'Connection' })).toHaveAttribute('aria-invalid', 'true')
  })
})
