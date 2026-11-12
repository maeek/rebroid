import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProviderConnectionFields } from './provider-connection-fields'
import { createProviderDraft, emptyProvider } from './provider-form-model'
import { ProviderNumberField } from './provider-number-field'

describe('AI provider fields', () => {
  it('connects provider labels and descriptions to their controls', () => {
    const onChange = vi.fn()
    render(
      <ProviderConnectionFields
        provider={emptyProvider()}
        mode='create'
        onChange={onChange}
      />
    )

    const providerId = screen.getByLabelText('Provider ID')
    expect(providerId.getAttribute('id')).toBe('provider-create-id')
    expect(providerId.getAttribute('aria-describedby')).toBe('provider-create-id-description')
    expect(screen.getByRole('combobox', { name: 'Provider' }).getAttribute('id')).toBe('provider-create-kind')

    fireEvent.change(providerId, { target: { value: 'local' } })
    expect(onChange).toHaveBeenCalledWith({ id: 'local' })
  })

  it('shows an editable OpenAI URL and keeps local transport controls out of setup', () => {
    const onChange = vi.fn()
    render(
      <ProviderConnectionFields
        provider={createProviderDraft()}
        mode='create'
        onChange={onChange}
      />
    )

    const url = screen.getByLabelText('Base URL')
    expect(url).toHaveValue('https://api.openai.com/v1')
    fireEvent.change(url, { target: { value: 'https://proxy.example/v1' } })
    expect(onChange).toHaveBeenCalledWith({ baseUrl: 'https://proxy.example/v1' })
    fireEvent.click(screen.getByRole('button', { name: 'Advanced connection settings' }))
    expect(screen.queryByLabelText('Transport protocol')).toBeNull()
  })

  it('supports optional and disabled numeric settings', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ProviderNumberField
        controlId='temperature'
        label='Temperature'
        description='Sampling randomness.'
        value={null}
        disabled
        onChange={onChange}
      />
    )

    const disabledInput = screen.getByLabelText('Temperature')
    expect(disabledInput).toBeDisabled()
    expect(disabledInput).toHaveValue(null)

    rerender(
      <ProviderNumberField
        controlId='temperature'
        label='Temperature'
        description='Sampling randomness.'
        value={0.4}
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
