import { NoInputState, TextField, TextareaField } from './action-fields'
import { normalizeStringInput, stringInputValue } from './input-values'
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
  noInputMessage?: string
}

export const createNoInputAction = (options: BaseActionOptions): AutomationActionDefinition => ({
  ...options,
  defaultInput: () => ({}),
  summary: () => options.noInputMessage ?? options.description ?? '',
  renderEditor: ({ command }) => (
    <NoInputState message={options.noInputMessage ?? options.description ?? command?.description} />
  )
})

export const createTextAction = ({
  field,
  fieldLabel,
  defaultValue = '',
  multiline = false,
  fieldDescription,
  placeholder,
  maskSummary = false,
  ...options
}: BaseActionOptions & {
  field: string
  fieldLabel: string
  defaultValue?: string
  multiline?: boolean
  fieldDescription?: string
  placeholder?: string
  maskSummary?: boolean
}): AutomationActionDefinition => ({
  ...options,
  defaultInput: () => ({ [field]: defaultValue }),
  normalizeInput: input => normalizeStringInput(input, field, defaultValue),
  summary: input => {
    const value = stringInputValue(input, field)
    return maskSummary ? `${value.length} characters` : value || fieldDescription || ''
  },
  renderEditor: ({ input, patchInput }) =>
    multiline ? (
      <TextareaField
        field={field}
        label={fieldLabel}
        description={fieldDescription}
        placeholder={placeholder}
        value={stringInputValue(input, field)}
        onChange={value => patchInput({ [field]: value })}
      />
    ) : (
      <TextField
        field={field}
        label={fieldLabel}
        description={fieldDescription}
        placeholder={placeholder}
        error={
          field === 'path' && stringInputValue(input, field) && !stringInputValue(input, field).startsWith('/')
            ? 'Enter an absolute Android path beginning with /.'
            : undefined
        }
        value={stringInputValue(input, field)}
        onChange={value => patchInput({ [field]: value })}
      />
    )
})
