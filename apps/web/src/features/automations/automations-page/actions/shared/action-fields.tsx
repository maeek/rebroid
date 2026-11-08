import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

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
  onChange
}: {
  label: string
  value: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <FormField
      label={suffix ? `${label} (${suffix})` : label}
      layout='vertical'
    >
      <Input
        type='number'
        className='max-w-48'
        inputMode='numeric'
        value={String(value)}
        onChange={event => onChange(Number(event.target.value || 0))}
      />
    </FormField>
  )
}

export function TextField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <FormField
      label={label}
      layout='vertical'
    >
      <Input
        className='max-w-[40rem]'
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </FormField>
  )
}

export function TextareaField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <FormField
      label={label}
      layout='vertical'
    >
      <Textarea
        value={value}
        className='min-h-28 max-w-[40rem]'
        onChange={event => onChange(event.target.value)}
      />
    </FormField>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: Array<string | SelectOption>
  onChange: (value: string) => void
}) {
  const normalizedOptions = normalizeOptions(options)

  return (
    <FormField
      label={label}
      layout='vertical'
    >
      <Select
        value={value}
        onValueChange={onChange}
      >
        <SelectTrigger className='w-full max-w-[40rem]'>
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
    </FormField>
  )
}

export function NoInputState({ message = 'No settings.' }: { message?: string }) {
  return <p className='text-sm text-foreground-muted'>{message}</p>
}
