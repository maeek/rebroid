'use client'

import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { getAutomationCommandCategory } from './automation-command-catalog'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationActionPicker({
  commands,
  value,
  onChange,
  ...attributes
}: {
  commands: AutomationCommand[]
  value: string
  onChange: (uses: string) => void
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}) {
  return (
    <SingleSelectCombobox
      {...attributes}
      value={value}
      onValueChange={onChange}
      placeholder='Search actions'
      options={commands.map(command => ({
        value: command.uses,
        label: command.label || command.uses,
        description: command.description,
        keywords: [command.uses, getAutomationCommandCategory(command.uses)]
      }))}
    />
  )
}
