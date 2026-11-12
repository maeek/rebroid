import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { ConsoleDefaultsFields } from './console-defaults-fields'

const Settings = () => {
  const [settings, setSettings] = useState(defaultOrchestratorUiSettings)
  return (
    <>
      <ConsoleDefaultsFields
        settings={settings}
        onSettingsChange={patch => setSettings(current => ({ ...current, ...patch }))}
      />
    </>
  )
}

describe('Console defaults fields', () => {
  it('preserves focus while changing streaming quality and keeps the helper text associated', () => {
    render(<Settings />)
    const bitrate = screen.getByRole('spinbutton', { name: 'Bitrate' })
    bitrate.focus()
    fireEvent.change(bitrate, { target: { value: '12' } })
    expect(bitrate).toHaveFocus()
    expect(bitrate).toHaveValue(12)
    expect(bitrate).toHaveAccessibleDescription('Stream bitrate in Mbps.')
    expect(screen.getByRole('spinbutton', { name: 'List refresh interval' })).toHaveAccessibleDescription(
      'Controls how often app lists refresh automatically across the frontend.'
    )
  })

  it('keeps known field descriptions and section headings visible during loading without enabling edits', () => {
    const onChange = vi.fn()
    render(
      <>
        <ConsoleDefaultsFields
          settings={defaultOrchestratorUiSettings}
          onSettingsChange={onChange}
          loading
        />
      </>
    )
    expect(screen.getByRole('region', { name: 'Frontend defaults' })).toBeVisible()
    expect(screen.getByText('Controls how often app lists refresh automatically across the frontend.')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Preset' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Enable sound' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
})
