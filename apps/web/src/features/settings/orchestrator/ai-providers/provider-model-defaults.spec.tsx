import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { emptyModel } from './provider-form-model'
import { ProviderModelDefaults } from './provider-model-defaults'

it('selects the chosen row when draft models share an ID', () => {
  const model = { ...emptyModel(), id: 'shared' }
  const onChange = vi.fn()
  render(
    <ProviderModelDefaults
      models={[
        { ...model, label: 'First' },
        { ...model, label: 'Second' }
      ]}
      onChange={onChange}
    />
  )
  const select = screen.getByRole('combobox', { name: 'Device control' })
  expect(select).toHaveTextContent('First')
  fireEvent.click(select)
  const option = screen.getByRole('option', { name: 'Second' })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
  expect(onChange).toHaveBeenCalledExactlyOnceWith(1, 'controller')
})
