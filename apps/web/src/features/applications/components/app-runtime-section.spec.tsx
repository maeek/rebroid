import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { AppRuntimeSection } from './app-runtime-section'

describe('AppRuntimeSection', () => {
  it('emits inactivity timeout patch when changed', () => {
    const onChange = jest.fn()

    render(
      <AppRuntimeSection
        values={{ inactivityTimeoutSeconds: 120 }}
        onChange={onChange}
      />
    )

    const timeoutInput = screen.getByDisplayValue('120')
    fireEvent.change(timeoutInput, { target: { value: '300' } })

    expect(onChange).toHaveBeenCalledWith({ inactivityTimeoutSeconds: 300 })
  })
})
