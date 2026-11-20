import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppInactivityTimeoutField } from './app-inactivity-timeout-field'

describe('AppInactivityTimeoutField', () => {
  it('emits inactivity timeout patch when changed', () => {
    const onChange = vi.fn()

    render(
      <AppInactivityTimeoutField
        values={{ inactivityTimeoutSeconds: '120' }}
        onChange={onChange}
      />
    )

    const timeoutInput = screen.getByDisplayValue('120')
    fireEvent.change(timeoutInput, { target: { value: '300' } })

    expect(onChange).toHaveBeenCalledWith({ inactivityTimeoutSeconds: '300' })
  })
})
