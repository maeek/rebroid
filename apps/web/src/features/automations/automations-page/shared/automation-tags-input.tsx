'use client'

import { type KeyboardEvent, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
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

  const commitDraft = () => {
    const tag = normalizeTag(draft)
    if (!tag) return
    const exists = value.some(item => item.toLowerCase() === tag.toLowerCase())
    if (!exists) {
      onChange([...value, tag])
    }
    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    commitDraft()
  }

  const removeTag = (tag: string) => {
    onChange(value.filter(item => item !== tag))
  }

  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <div className='flex min-h-11 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-input px-3 py-2 dark:bg-white/5 focus-visible:border-primary/60 hover:bg-input/84 hover:border-primary/40'>
        {value.map(tag => (
          <Badge
            key={tag}
            variant='secondary'
            className='flex items-center gap-1 rounded-md border border-border/60 bg-secondary px-2 py-1 text-xs font-medium'
          >
            <span>{tag}</span>
            <button
              type='button'
              className='cursor-pointer rounded-sm text-muted-foreground transition hover:text-foreground'
              aria-label={`Remove ${tag}`}
              onClick={() => removeTag(tag)}
            >
              <IconX className='size-3.5' />
            </button>
          </Badge>
        ))}
        <input
          id={id}
          value={draft}
          className='h-7 min-w-34 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground'
          placeholder='Add tag and press Enter'
          onBlur={commitDraft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}
