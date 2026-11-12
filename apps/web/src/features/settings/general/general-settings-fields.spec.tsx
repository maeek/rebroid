import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppearanceSettings } from './general-settings-fields'

describe('Personal appearance settings', () => {
  it('shows the current accent and personal display controls', () => {
    render(
      <AppearanceSettings
        accentColor='blue'
        onAccentColorChange={() => {}}
      />
    )
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Theme' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Viewer layout' })).toBeVisible()
  })

  it('keeps controls inert and hides the accent selection during loading', () => {
    const onChange = vi.fn()
    render(
      <AppearanceSettings
        accentColor='blue'
        onAccentColorChange={onChange}
        loading
      />
    )
    expect(screen.getByRole('combobox', { name: 'Theme' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Viewer layout' })).toBeDisabled()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
})
