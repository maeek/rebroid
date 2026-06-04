import { NoInputState, NumberField, TextField, TextareaField } from './action-fields'
import { normalizeNumberInput, normalizeStringInput, numberInputValue, stringInputValue } from './input-values'
import type {
  AutomationActionCategory,
  AutomationActionDefinition,
  AutomationActionIconKey
} from '../automation-action-definition'

interface BaseActionOptions {
  uses: string
  category: AutomationActionCategory
  iconKey: AutomationActionIconKey
  label?: string
  description?: string
}

export const createNoInputAction = (options: BaseActionOptions): AutomationActionDefinition => ({
  ...options,
  defaultInput: () => ({}),
  summary: () => 'No input',
  renderEditor: () => <NoInputState />
})

export const createTextAction = ({
  field,
  fieldLabel,
  defaultValue = '',
  multiline = false,
  ...options
}: BaseActionOptions & {
  field: string
  fieldLabel: string
  defaultValue?: string
  multiline?: boolean
}): AutomationActionDefinition => ({
  ...options,
  defaultInput: () => ({ [field]: defaultValue }),
  normalizeInput: input => normalizeStringInput(input, field, defaultValue),
  summary: input => stringInputValue(input, field) || `${field}:`,
  renderEditor: ({ input, patchInput }) =>
    multiline ? (
      <TextareaField
        label={fieldLabel}
        value={stringInputValue(input, field)}
        onChange={value => patchInput({ [field]: value })}
      />
    ) : (
      <TextField
        label={fieldLabel}
        value={stringInputValue(input, field)}
        onChange={value => patchInput({ [field]: value })}
      />
    )
})

export const createNumberAction = ({
  field,
  fieldLabel,
  defaultValue,
  suffix,
  summary,
  ...options
}: BaseActionOptions & {
  field: string
  fieldLabel: string
  defaultValue: number
  suffix?: string
  summary?: (value: number) => string
}): AutomationActionDefinition => ({
  ...options,
  defaultInput: () => ({ [field]: defaultValue }),
  normalizeInput: input => normalizeNumberInput(input, field, defaultValue),
  summary: input => {
    const value = numberInputValue(input, field, defaultValue)
    return summary ? summary(value) : `${fieldLabel} ${value}${suffix ?? ''}`
  },
  renderEditor: ({ input, patchInput }) => (
    <NumberField
      label={fieldLabel}
      suffix={suffix}
      value={numberInputValue(input, field, defaultValue)}
      onChange={value => patchInput({ [field]: value })}
    />
  )
})
