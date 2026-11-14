'use client'

import { FormField } from '@/components/ui/form-field'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { AutomationLiteralValueEditor } from '../editors/automation-literal-value-editor'
import {
  buildReferenceOptions,
  referenceOptionId,
  valueRefFromReferenceId,
  valueRefLabel
} from './automation-value-ref-utils'
import type { AutomationStepReferenceOption } from './automation-value-ref-constants'
import type { AutomationValueRef } from '@rebroid/automation-core/definition'

export function AutomationReferencePicker({
  id,
  label,
  value,
  stepOptions,
  onChange
}: {
  id: string
  label: string
  value: AutomationValueRef
  stepOptions: AutomationStepReferenceOption[]
  onChange: (value: AutomationValueRef) => void
}) {
  const references = buildReferenceOptions(stepOptions)
  const selectedId = value.source === 'literal' ? 'literal' : referenceOptionId(value)
  const options = [
    { value: 'literal', label: 'Enter a value', group: 'Literal' },
    ...references.map(reference => ({
      value: reference.id,
      label: reference.label,
      group: reference.group,
      description: reference.type === 'unknown' ? undefined : reference.type
    }))
  ]
  if (!options.some(option => option.value === selectedId)) {
    options.push({
      value: selectedId,
      label: `${valueRefLabel(value, stepOptions)} (unavailable)`,
      group: 'Previous steps'
    })
  }
  return (
    <div className='grid min-w-0 gap-3'>
      <FormField
        controlId={id}
        label={label}
        layout='vertical'
      >
        <SingleSelectCombobox
          options={options}
          value={selectedId}
          placeholder='Find a value or output'
          onValueChange={nextId => {
            if (nextId === 'literal') {
              if (value.source !== 'literal') onChange({ source: 'literal', value: '' })
              return
            }
            if (references.some(option => option.id === nextId)) onChange(valueRefFromReferenceId(nextId, references))
          }}
        />
      </FormField>
      {value.source === 'literal' ? (
        <AutomationLiteralValueEditor
          id={`${id}-literal`}
          label='Entered value'
          value={value.value}
          onChange={literal => onChange({ source: 'literal', value: literal })}
        />
      ) : null}
    </div>
  )
}
