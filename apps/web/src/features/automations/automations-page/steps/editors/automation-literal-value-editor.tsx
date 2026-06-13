'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { literalKind as resolveLiteralKind, defaultLiteralValue } from '../value-ref/automation-value-ref-utils'

const literalInputValue = (value: unknown) => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function AutomationLiteralValueEditor({
  id,
  value,
  label = 'Value',
  onChange
}: {
  id: string
  value: unknown
  label?: string
  onChange: (value: unknown) => void
}) {
  const kind = resolveLiteralKind(value)

  return (
    <div className='grid gap-3 md:grid-cols-[9rem_minmax(0,1fr)]'>
      <div className='grid gap-2'>
        <Label htmlFor={`${id}-type`}>Type</Label>
        <Select
          value={kind}
          onValueChange={nextKind => onChange(defaultLiteralValue(nextKind))}
        >
          <SelectTrigger
            id={`${id}-type`}
            className='w-full'
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='string'>Text</SelectItem>
            <SelectItem value='number'>Number</SelectItem>
            <SelectItem value='boolean'>Boolean</SelectItem>
            <SelectItem value='null'>Empty</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className='grid gap-2'>
        <Label htmlFor={id}>{label}</Label>
        {kind === 'boolean' ? (
          <Select
            value={value === true ? 'true' : 'false'}
            onValueChange={nextValue => onChange(nextValue === 'true')}
          >
            <SelectTrigger
              id={id}
              className='w-full'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='true'>True</SelectItem>
              <SelectItem value='false'>False</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={id}
            type={kind === 'number' ? 'number' : 'text'}
            disabled={kind === 'null'}
            value={kind === 'null' ? '' : literalInputValue(value)}
            onChange={event => onChange(kind === 'number' ? Number(event.target.value) || 0 : event.target.value)}
          />
        )}
      </div>
    </div>
  )
}
