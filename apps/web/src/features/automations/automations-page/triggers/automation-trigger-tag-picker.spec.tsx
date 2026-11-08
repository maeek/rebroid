import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildAutomationTagCatalog } from '../shared/automation-tags'
import { AutomationTriggerTagPicker } from './automation-trigger-tag-picker'
import type { AutomationTag } from '@rebroid/automation-core/definition'

function Picker() {
  const [value, setValue] = useState<AutomationTag[]>([{ name: 'Nightly', color: '#2563eb' }])
  return (
    <>
      <AutomationTriggerTagPicker
        suggestions={[{ name: 'nightly', color: '#64748b' }]}
        value={value}
        disabled={false}
        onChange={setValue}
      />
      <output aria-label='Selected tags'>{JSON.stringify(value)}</output>
    </>
  )
}

describe('trigger tag reuse', () => {
  it('deduplicates case-insensitively while preserving selected tag names and colors', () => {
    expect(buildAutomationTagCatalog(['nightly', 'smoke'], [{ name: 'Nightly', color: '#2563eb' }])).toEqual([
      { name: 'Nightly', color: '#2563eb' },
      { name: 'smoke', color: '#64748b' }
    ])
  })

  it('does not create duplicates, overlong tags, or commit an unconfirmed search on blur', async () => {
    render(<Picker />)
    const input = screen.getByRole('combobox', { name: 'Tags' })
    fireEvent.click(input)
    fireEvent.input(input, { target: { value: 'NIGHTLY' } })
    expect(await screen.findByRole('option', { name: 'Nightly' })).toBeVisible()
    expect(screen.queryByRole('option', { name: /Create/ })).toBeNull()
    fireEvent.input(input, { target: { value: 'a'.repeat(49) } })
    expect(screen.queryByRole('option', { name: /Create/ })).toBeNull()
    fireEvent.input(input, { target: { value: 'unfinished' } })
    fireEvent.blur(input)
    expect(screen.getByText('[{"name":"Nightly","color":"#2563eb"}]')).toBeInTheDocument()
  })
})
