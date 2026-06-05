'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { buildReferenceOptions, referenceOptionId, valueRefFromReferenceId } from './automation-value-ref-utils'
import type { AutomationStepReferenceOption } from './automation-value-ref-constants'
import type { AutomationValueRef } from '@/server/orchestrator/automations/types'

export function AutomationReferencePicker({
  id,
  label,
  value,
  stepOptions,
  onChange
}: {
  id: string
  label: string
  value: Exclude<AutomationValueRef, { source: 'literal' }>
  stepOptions: AutomationStepReferenceOption[]
  onChange: (value: Exclude<AutomationValueRef, { source: 'literal' }>) => void
}) {
  const references = useMemo(() => buildReferenceOptions(stepOptions), [stepOptions])
  const selectedId = referenceOptionId(value)
  const grouped = {
    context: references.filter(option => option.group === 'Run context'),
    steps: references.filter(option => option.group === 'Previous steps')
  }

  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={selectedId}
        onValueChange={nextId => {
          const nextValue = valueRefFromReferenceId(nextId, references)
          if (nextValue.source !== 'literal') onChange(nextValue)
        }}
      >
        <SelectTrigger
          id={id}
          className='w-full'
        >
          <SelectValue placeholder='Choose value' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value='__context'
            disabled
          >
            Run context
          </SelectItem>
          {grouped.context.map(option => (
            <SelectItem
              key={option.id}
              value={option.id}
            >
              {option.label}
            </SelectItem>
          ))}
          <SelectItem
            value='__steps'
            disabled
          >
            Previous steps
          </SelectItem>
          {grouped.steps.length === 0 ? (
            <SelectItem
              value='__no_steps'
              disabled
            >
              No previous step outputs
            </SelectItem>
          ) : (
            grouped.steps.map(option => (
              <SelectItem
                key={option.id}
                value={option.id}
              >
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
