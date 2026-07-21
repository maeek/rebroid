import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'

export const ProviderNumberField = ({
  controlId,
  label,
  description,
  value,
  min,
  max,
  step,
  disabled,
  onChange
}: {
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
