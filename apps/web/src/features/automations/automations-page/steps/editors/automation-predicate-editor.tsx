'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { operatorOptions } from '../value-ref/automation-value-ref-constants'
import { AutomationValueRefEditor } from '../value-ref/automation-value-ref-editor'
import type { AutomationStepReferenceOption } from '../value-ref/automation-value-ref-constants'
import type { AutomationPredicate, AutomationPredicateOperator } from '@/server/orchestrator/automations/types'

export function AutomationPredicateEditor({
  id,
  label,
  value,
  stepOptions,
  onChange
}: {
  id: string
  label: string
  value: AutomationPredicate
  stepOptions: AutomationStepReferenceOption[]
  onChange: (value: AutomationPredicate) => void
}) {
  const right = value.right ?? { source: 'literal', value: '' }

  return (
    <div className='grid gap-3'>
      <Label>{label}</Label>
      <div className='grid gap-3 rounded-md border border-border/60 p-3'>
        <AutomationValueRefEditor
          id={`${id}-left`}
          label='Left value'
          value={value.left}
          stepOptions={stepOptions}
          onChange={left => onChange({ ...value, left })}
        />
        <div className='grid gap-2'>
          <Label htmlFor={`${id}-operator`}>Operator</Label>
          <Select
            value={value.operator}
            onValueChange={operator =>
              onChange({
                ...value,
                operator: operator as AutomationPredicateOperator,
                ...(operator === 'exists' ? { right: undefined } : { right })
              })
            }
          >
            <SelectTrigger
              id={`${id}-operator`}
              className='w-full'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operatorOptions.map(option => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {value.operator === 'exists' ? null : (
          <AutomationValueRefEditor
            id={`${id}-right`}
            label='Right value'
            value={right}
            stepOptions={stepOptions}
            onChange={nextRight => onChange({ ...value, right: nextRight })}
          />
        )}
      </div>
    </div>
  )
}
