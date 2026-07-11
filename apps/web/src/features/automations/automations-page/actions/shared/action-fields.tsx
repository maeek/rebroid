import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className='grid gap-2'>
      <Label>{label}</Label>
      <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2'>
        <Input
          type='number'
          inputMode='numeric'
          value={String(value)}
          onChange={event => onChange(Number(event.target.value || 0))}
        />
        {suffix ? <span className='text-xs text-foreground-muted'>{suffix}</span> : null}
      </div>
    </div>
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
    <div className='grid gap-2'>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </div>
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
    <div className='grid gap-2'>
      <Label>{label}</Label>
      <Textarea
        value={value}
        className='min-h-28'
        onChange={event => onChange(event.target.value)}
      />
    </div>
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
    <div className='grid gap-2'>
      <Label>{label}</Label>
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
    </div>
  )
}

export function SegmentedField({
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
    <div className='grid gap-2'>
      <Label>{label}</Label>
      <div className='grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2'>
        {normalizedOptions.map(option => (
          <Button
            key={option.value}
            type='button'
            variant={value === option.value ? 'primary' : 'secondary'}
            onClick={() => onChange(option.value)}
          >
            {option.label ?? option.value}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function NoInputState({ message = 'No settings.' }: { message?: string }) {
  return <p className='rounded-control bg-surface-band/45 px-3 py-3 text-sm text-foreground-muted'>{message}</p>
}
