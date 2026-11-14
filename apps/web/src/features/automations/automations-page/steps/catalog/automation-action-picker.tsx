'use client'

import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { automationActionGroups, automationActionPresentation } from '@/shared/model/workflow-action-presentation'
import type { AutomationCommand } from '@/shared/contracts/automation'

export function AutomationActionPicker({
  commands,
  includeBlocks = false,
  inline = false,
  value,
  onChange,
  ...attributes
}: {
  commands: AutomationCommand[]
  includeBlocks?: boolean
  inline?: boolean
  value: string
  onChange: (uses: string) => void
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}) {
  const actions = commands.map(command => {
    const [group, label, keywords] = automationActionPresentation[command.uses] ?? [
      'Device & apps',
      command.label || command.uses
    ]
    return {
      value: command.uses,
      label,
      description: command.description,
      group,
      keywords: [command.uses, command.label, keywords ?? '']
    }
  })
  const options = includeBlocks ? [...actions, ...blockOptions] : actions
  return (
    <SingleSelectCombobox
      {...attributes}
      value={value}
      onValueChange={onChange}
      inline={inline}
      placeholder={includeBlocks ? 'Search steps' : 'Search actions'}
      options={options.toSorted((left, right) => {
        const groupOrder = automationActionGroups.indexOf(left.group) - automationActionGroups.indexOf(right.group)
        if (groupOrder) return groupOrder
        return Number(right.value === 'android.swipeNormalized') - Number(left.value === 'android.swipeNormalized')
      })}
    />
  )
}

export const workflowBlockChoices = ['condition', 'switch', 'repeat'] as const

const blockOptions = [
  {
    value: 'condition',
    label: 'Condition',
    description: 'Choose between Then and Otherwise.',
    keywords: ['if', 'branch']
  },
  {
    value: 'switch',
    label: 'Switch',
    description: 'Choose the first case that matches a value.',
    keywords: ['case', 'branch']
  },
  {
    value: 'repeat',
    label: 'Repeat',
    description: 'Run steps a fixed number of times or while a condition holds.',
    keywords: ['loop', 'while']
  }
].map(option => ({ ...option, group: 'Flow control' as const }))
