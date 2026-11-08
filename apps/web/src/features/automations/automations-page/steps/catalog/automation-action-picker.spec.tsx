import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from '@/components/ui/form-field'
import { AutomationActionPicker } from './automation-action-picker'
import type { AutomationCommand } from '@/shared/contracts/automation'

const commands: AutomationCommand[] = [
  { uses: 'android.viewerCommand', label: 'Viewer command', description: 'Wake or lock the device.' },
  { uses: 'debug.log', label: 'Log message', description: 'Write a message to the execution history.' }
].map(command => ({
  ...command,
  requiredPermissions: [],
  inputSchema: {},
  outputs: [],
  editor: { inputDefaults: {}, inputFieldOrder: [], yamlSnippetFields: [] }
}))

function Picker() {
  const [value, setValue] = useState('android.viewerCommand')
  return (
    <FormField
      label='Action'
      description='Choose the action for this step.'
      error='Check this action.'
      layout='vertical'
    >
      <AutomationActionPicker
        commands={commands}
        value={value}
        onChange={setValue}
      />
    </FormField>
  )
}

describe('AutomationActionPicker', () => {
  it('associates the interactive catalog with its label, description, and error', () => {
    render(<Picker />)
    const input = screen.getByRole('combobox', { name: 'Action' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Choose the action for this step. Check this action.')
  })

  it('searches command identifiers and selects an exact command using the keyboard', async () => {
    render(<Picker />)
    const input = screen.getByRole('combobox', { name: 'Action' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'debug.log' } })
    expect(await screen.findByRole('option', { name: /Log message/ })).toBeVisible()
    expect(screen.queryByRole('option', { name: /Viewer command/ })).toBeNull()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('Log message')
  })
})
