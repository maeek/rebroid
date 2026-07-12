'use client'

import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
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
    <section className={cn('flex flex-col w-full gap-4 pb-4', className)}>
      <div className='flex h-8 items-center justify-between gap-3'>
        <h2 className='text-xl font-medium'>Details</h2>
      </div>
      <div className='grid gap-4'>
        <FormField
          controlId='automation-name'
          label='Name'
          layout='vertical'
        >
          <Input
            value={form.name}
            onChange={event => onChange({ name: event.target.value })}
          />
        </FormField>
        <FormField
          controlId='automation-description'
          label='Description'
          layout='vertical'
        >
          <Textarea
            value={form.description}
            onChange={event => onChange({ description: event.target.value })}
          />
        </FormField>
        <AutomationTagsInput
          id='automation-tags'
          value={form.tags}
          onChange={tags => onChange({ tags })}
        />
      </div>
    </section>
  )
}
