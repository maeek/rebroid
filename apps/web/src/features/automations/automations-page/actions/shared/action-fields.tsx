import { useState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AutomationBoundControl, useAutomationField } from '../../steps/value-ref/automation-input-bindings'

interface FieldDetails {
  field?: string
  description?: string
}

export interface SelectOption {
  value: string
  label?: string
}

const normalizeOptions = (options: Array<string | SelectOption>) =>
  options.map(option => (typeof option === 'string' ? { value: option, label: option } : option))

export function NumberField({
  label,
  value,
  suffix,
  field,
  description,
  min,
  max,
  step,
  onChange
}: {
  label: string
  value: number | undefined
  suffix?: string
  min?: number
  max?: number
  step?: number | 'any'
  onChange: (value: number) => void
} & FieldDetails) {
  const { property } = useAutomationField(field)
  const minimum = min ?? (typeof property?.minimum === 'number' ? property.minimum : undefined)
  const maximum = max ?? (typeof property?.maximum === 'number' ? property.maximum : undefined)
  const increment = step ?? (property?.type === 'integer' ? 1 : 'any')
  const [empty, setEmpty] = useState(false)
  const outOfRange =
    value !== undefined && ((minimum !== undefined && value < minimum) || (maximum !== undefined && value > maximum))
  const range = [minimum !== undefined ? `at least ${minimum}` : '', maximum !== undefined ? `at most ${maximum}` : '']
    .filter(Boolean)
    .join(' and ')
  const integerError = increment === 1 && value !== undefined && !Number.isInteger(value)
  let error: string | undefined
  if (outOfRange) error = `Enter a value that is ${range}.`
  else if (integerError) error = 'Enter a whole number.'

  return (
    <FormField
      label={suffix ? `${label} (${suffix})` : label}
      description={description}
      error={error}
      layout='vertical'
    >
      <AutomationBoundControl
        field={field}
        label={label}
      >
        <Input
          type='number'
          className='w-full tabular-nums'
          inputMode={increment === 1 ? 'numeric' : 'decimal'}
          min={minimum}
          max={maximum}
          step={increment}
          value={empty ? '' : String(value ?? '')}
          onBlur={() => setEmpty(false)}
          onChange={event => {
            const next = event.target.valueAsNumber
            setEmpty(Number.isNaN(next))
            if (Number.isFinite(next)) onChange(next)
          }}
        />
      </AutomationBoundControl>
    </FormField>
  )
}

export function TextField({
  label,
  value,
  field,
  description,
  placeholder,
  maxLength,
  className,
  error,
  onChange
}: {
  label: string
  value: string
  placeholder?: string
  maxLength?: number
  className?: string
  error?: string
  onChange: (value: string) => void
} & FieldDetails) {
  const { property } = useAutomationField(field)
  return (
    <FormField
      label={label}
      description={description}
      error={error}
      layout='vertical'
    >
      <AutomationBoundControl
        field={field}
        label={label}
      >
        <Input
          value={value}
          placeholder={placeholder}
          maxLength={maxLength ?? (typeof property?.maxLength === 'number' ? property.maxLength : undefined)}
          className={className}
          onChange={event => onChange(event.target.value)}
        />
      </AutomationBoundControl>
    </FormField>
  )
}

export function TextareaField({
  label,
  value,
  field,
  description,
  placeholder,
  maxLength,
  className,
  error,
  onChange
}: {
  label: string
  value: string
  placeholder?: string
  maxLength?: number
  className?: string
  error?: string
  onChange: (value: string) => void
} & FieldDetails) {
  const { property } = useAutomationField(field)
  return (
    <FormField
      label={label}
      description={description}
      error={error}
      layout='vertical'
    >
      <AutomationBoundControl
        field={field}
        label={label}
      >
        <Textarea
          value={value}
          placeholder={placeholder}
          maxLength={maxLength ?? (typeof property?.maxLength === 'number' ? property.maxLength : undefined)}
          className={className}
          onChange={event => onChange(event.target.value)}
        />
      </AutomationBoundControl>
    </FormField>
  )
}

export function SelectField({
  label,
  value,
  options,
  field,
  description,
  onChange
}: {
  label: string
  value: string
  options: Array<string | SelectOption>
  onChange: (value: string) => void
} & FieldDetails) {
  const normalizedOptions = normalizeOptions(options)

  return (
    <FormField
      label={label}
      description={description}
      layout='vertical'
    >
      <AutomationBoundControl
        field={field}
        label={label}
      >
        <Select
          value={value}
          onValueChange={onChange}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {normalizedOptions.map(option => (
              <SelectItem
                key={option.value}
                value={option.value}
              >
                {option.label ?? option.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AutomationBoundControl>
    </FormField>
  )
}

export function NoInputState({ message = 'No settings.' }: { message?: string }) {
  return <p className='text-sm text-foreground-muted'>{message}</p>
}
