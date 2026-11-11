'use client'

import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { AutomationTagsInput } from '../shared/automation-tags-input'
import type { AutomationFormState } from './builder-utils'

export function AutomationDetailsSection({
  form,
  onChange,
  className
}: {
  form: AutomationFormState
  onChange: (patch: Partial<AutomationFormState>) => void
  className?: string
}) {
  return (
    <Section
      surface='panel'
      title='Workflow details'
      className={cn('min-w-0', className)}
    >
      <div className='grid min-w-0 items-start gap-x-form-column gap-y-4 md:grid-cols-2'>
        <FormField
          controlId='automation-name'
          label='Name'
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
          layout='vertical'
          className='md:col-span-2'
        >
          <Textarea
            value={form.description}
            className='min-h-28'
            onChange={event => onChange({ description: event.target.value })}
          />
        </FormField>
      </div>
    </Section>
  )
}
