'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AutomationFormState } from './builder-utils'

export function AutomationDetailsSection({
  form,
  onChange
}: {
  form: AutomationFormState
  onChange: (patch: Partial<AutomationFormState>) => void
}) {
  return (
    <section className='grid w-full gap-4 pb-4'>
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
          <Input
            id='automation-description'
            value={form.description}
            onChange={event => onChange({ description: event.target.value })}
          />
        </div>
      </div>
    </section>
  )
}
