'use client'

import { useState } from 'react'
import { IconPlus, IconX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const normalizeTag = (value: string) => value.trim()

export function AutomationTagsInput({
  id,
  label = 'Tags',
  value,
  onChange
}: {
  id: string
  label?: string
  value: string[]
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  const addTag = () => {
    const tag = normalizeTag(draft)
    if (!tag) return
    const exists = value.some(item => item.toLowerCase() === tag.toLowerCase())
    if (!exists) {
      onChange([...value, tag])
    }
    setDraft('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter(item => item !== tag))
  }

  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <div className='flex flex-wrap gap-2'>
        {value.map(tag => (
          <Badge
            key={tag}
            variant='secondary'
            className='gap-1 pr-1'
          >
            {tag}
            <button
              type='button'
              className='rounded-xs p-0.5 hover:bg-background/50'
              aria-label={`Remove ${tag}`}
              onClick={() => removeTag(tag)}
            >
              <IconX className='size-3' />
            </button>
          </Badge>
        ))}
      </div>
      <div className='flex gap-2'>
        <Input
          id={id}
          value={draft}
          placeholder='Add tag'
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addTag()
            }
            if (event.key === 'Backspace' && !draft && value.length > 0) {
              onChange(value.slice(0, -1))
            }
          }}
        />
        <Button
          type='button'
          variant='secondary'
          onClick={addTag}
        >
          <IconPlus className='size-4' />
          Add
        </Button>
      </div>
    </div>
  )
}
