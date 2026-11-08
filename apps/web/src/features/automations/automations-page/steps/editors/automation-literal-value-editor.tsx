'use client'

import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
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
      <FormField
        controlId={`${id}-type`}
        label='Type'
        layout='vertical'
      >
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
      </FormField>
      <FormField
        controlId={id}
        label={label}
        layout='vertical'
      >
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
            className={kind === 'number' ? 'max-w-48' : undefined}
            disabled={kind === 'null'}
            value={kind === 'null' ? '' : literalInputValue(value)}
            onChange={event => onChange(kind === 'number' ? Number(event.target.value) || 0 : event.target.value)}
          />
        )}
      </FormField>
    </div>
  )
}
