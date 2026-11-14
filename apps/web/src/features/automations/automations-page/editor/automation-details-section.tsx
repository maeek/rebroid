'use client'

import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AutomationTagsInput } from '../shared/automation-tags-input'
import type { AutomationFormState } from './builder-utils'

export function AutomationDetailsSection({
  form,
  onChange
}: {
  form: AutomationFormState
  onChange: (patch: Partial<AutomationFormState>) => void
}) {
  return (
    <div className='grid min-w-0 gap-4'>
      <FormField
        controlId='automation-name'
        label='Name'
        field='name'
        layout='vertical'
        required
      >
        <Input
          value={form.name}
          required
          onChange={event => onChange({ name: event.target.value })}
        />
      </FormField>
      <AutomationTagsInput
        id='automation-tags'
        value={form.tags}
        onChange={tags => onChange({ tags })}
      />
      <FormField
        controlId='automation-description'
        label='Description'
        field='description'
        layout='vertical'
      >
        <Textarea
          value={form.description}
          className='min-h-28'
          onChange={event => onChange({ description: event.target.value })}
        />
      </FormField>
    </div>
  )
}
