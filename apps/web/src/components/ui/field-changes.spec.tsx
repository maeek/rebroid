import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldChangesProvider, fieldValuesEqual } from './field-changes'
import { FormField } from './form-field'
import { FormLoadingContext } from './form-loading-boundary'
import { Input } from './input'

describe('saved field comparisons', () => {
  it('compares nested values without treating object order or absent optional values as edits', () => {
    expect(fieldValuesEqual({ temperature: null, roles: ['controller'] }, { roles: ['controller'] })).toBe(true)
    expect(fieldValuesEqual({ temperature: 0 }, {})).toBe(false)
    expect(fieldValuesEqual(['first', 'second'], ['second', 'first'])).toBe(false)
    expect(fieldValuesEqual(false, undefined)).toBe(false)
  })

  it('clears on revert and acknowledged save, and retains edits while the baseline is unchanged', () => {
    const field = (value: number, saved: number, loading = false) => (
      <FieldChangesProvider
        value={{ settings: { temperature: value } }}
        baseline={{ settings: { temperature: saved } }}
      >
        <FormLoadingContext.Provider value={loading}>
          <FormField
            label='Temperature'
            field={['settings', 'temperature']}
          >
            <Input
              value={value}
              readOnly
            />
          </FormField>
        </FormLoadingContext.Provider>
      </FieldChangesProvider>
    )
    const { rerender } = render(field(1, 1))
    const control = screen.getByRole('textbox', { name: 'Temperature' })
    expect(control).not.toHaveAccessibleDescription('Unsaved change')
    rerender(field(0, 1))
    expect(control).toHaveAccessibleDescription('Unsaved change')
    rerender(field(0, 1))
    expect(control).toHaveAccessibleDescription('Unsaved change')
    rerender(field(1, 1))
    expect(control).not.toHaveAccessibleDescription('Unsaved change')
    rerender(field(0, 0))
    expect(control).not.toHaveAccessibleDescription('Unsaved change')
    rerender(field(1, 0, true))
    expect(screen.queryByText('Unsaved change')).toBeNull()
  })

  it('does not mark unscoped controls or borrow another editor’s saved values', () => {
    render(
      <FieldChangesProvider
        value={{ name: 'Changed' }}
        baseline={{ name: 'Original' }}
      >
        <FieldChangesProvider>
          <FormField
            label='New resource'
            field='name'
          >
            <Input />
          </FormField>
        </FieldChangesProvider>
        <FormField label='Search'>
          <Input />
        </FormField>
      </FieldChangesProvider>
    )
    expect(screen.queryByText('Unsaved change')).toBeNull()
  })
})
