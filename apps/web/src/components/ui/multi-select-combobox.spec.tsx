import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MultiSelectCombobox } from './multi-select-combobox'

const options = [
  { value: 'administrators', label: 'Administrators', description: 'Full platform access.', keywords: ['admin'] },
  { value: 'users', label: 'Users', description: 'Standard application owners.' }
]

const TestCombobox = () => {
  const [value, setValue] = useState<string[]>([])

  return (
    <MultiSelectCombobox
      value={value}
      options={options}
      placeholder='Search groups'
      onValueChange={setValue}
    />
  )
}

describe('MultiSelectCombobox', () => {
  it('filters by keywords and adds a removable chip', async () => {
    render(<TestCombobox />)

    const input = screen.getByPlaceholderText('Search groups')
    fireEvent.click(input)
    fireEvent.input(input, { target: { value: 'admin' }, inputType: 'insertText' })

    expect(await screen.findByText('Administrators')).toBeTruthy()
    expect(screen.queryByText('Users')).toBeNull()

    fireEvent.click(screen.getByText('Administrators'))
    expect(screen.getByRole('button', { name: 'Remove Administrators' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Administrators' }))
    expect(screen.queryByRole('button', { name: 'Remove Administrators' })).toBeNull()
  })

  it('supports keyboard navigation', async () => {
    render(<TestCombobox />)

    const input = screen.getByPlaceholderText('Search groups')
    fireEvent.focus(input)
    fireEvent.click(input)
    const administrators = await screen.findByRole('option', { name: /Administrators/ })

    fireEvent.input(input, { target: { value: 'admin' }, inputType: 'insertText' })
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', administrators.id))
    expect(administrators).toHaveAttribute('data-highlighted')
  })
})
