import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import type { FieldPath } from '@/components/ui/field-changes'

export const ProviderNumberField = ({
  controlId,
  field,
  label,
  description,
  value,
  min,
  max,
  step,
  disabled,
  onChange
}: {
  field?: FieldPath
  controlId: string
  label: string
  description: string
  value?: number | null
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onChange: (value: number | null) => void
}) => (
  <FormField
    controlId={controlId}
    field={field}
    label={label}
    description={description}
    layout='vertical'
  >
    <Input
      type='number'
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
    />
  </FormField>
)
