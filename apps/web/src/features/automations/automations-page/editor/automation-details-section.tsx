'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
        <h3 className='text-xl font-medium'>Details</h3>
      </div>
      <div className='grid gap-4'>
        <div className='grid gap-2'>
          <Label htmlFor='automation-name'>Name</Label>
          <Input
            id='automation-name'
            value={form.name}
            onChange={event => onChange({ name: event.target.value })}
          />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='automation-description'>Description</Label>
          <Textarea
            id='automation-description'
            value={form.description}
            onChange={event => onChange({ description: event.target.value })}
          />
        </div>
        <AutomationTagsInput
          id='automation-tags'
          value={form.tags}
          onChange={tags => onChange({ tags })}
        />
      </div>
    </section>
  )
}
