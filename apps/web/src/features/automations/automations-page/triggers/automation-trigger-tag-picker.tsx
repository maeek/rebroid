'use client'

import { useMemo } from 'react'
import { FormField } from '@/components/ui/form-field'
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox'
import { buildAutomationTagCatalog, createAutomationTag } from '../shared/automation-tags'
import type { AutomationTag } from '@rebroid/automation-core/definition'

const createTagOption = (query: string) => {
  if (!query || query.length > 48) return null
  return { value: query, label: query }
}

export function AutomationTriggerTagPicker({
  suggestions,
  value,
  disabled,
  onChange
}: {
  suggestions: AutomationTag[]
  value: AutomationTag[]
  disabled: boolean
  onChange: (tags: AutomationTag[]) => void
}) {
  const catalog = useMemo(() => buildAutomationTagCatalog([], [...value, ...suggestions]), [value, suggestions])
  const byName = useMemo(() => new Map(catalog.map(tag => [tag.name, tag])), [catalog])
  return (
    <FormField
      label='Tags'
      description='Reuse a tag or type a new one and choose Create. Up to 48 characters per tag.'
      layout='vertical'
    >
      <MultiSelectCombobox
        options={catalog.map(tag => ({ value: tag.name, label: tag.name }))}
        value={value.map(tag => tag.name)}
        createOption={createTagOption}
        disabled={disabled}
        placeholder='Search or create tags'
        emptyLabel='No matching tags. Enter up to 48 characters to create one.'
        className='max-h-28 overflow-y-auto'
        onValueChange={names => onChange(names.map(name => byName.get(name) ?? createAutomationTag(name)))}
      />
    </FormField>
  )
}
