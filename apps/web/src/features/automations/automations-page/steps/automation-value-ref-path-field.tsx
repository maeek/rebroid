'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AutomationValueRefPathField({
  id,
  label,
  value,
  options,
  onChange
}: {
  id: string
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        list={`${id}-options`}
        onChange={event => onChange(event.target.value)}
      />
      <datalist id={`${id}-options`}>
        {options.map(option => (
          <option
            key={option}
            value={option}
          />
        ))}
      </datalist>
    </div>
  )
}
