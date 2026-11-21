import { NoInputState, TextField } from './action-fields'
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
  renderEditor: ({ input, patchInput }) => {
    const value = stringInputValue(input, field)
    return (
      <TextField
        field={field}
        label={fieldLabel}
        multiline={multiline}
        description={fieldDescription}
        placeholder={placeholder}
        error={
          !multiline && field === 'path' && value && !value.startsWith('/')
            ? 'Enter an absolute Android path beginning with /.'
            : undefined
        }
        value={value}
        onChange={next => patchInput({ [field]: next })}
      />
    )
  }
})
