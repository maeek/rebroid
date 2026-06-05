'use client'

import { type KeyboardEvent, useState } from 'react'
import { IconPalette, IconTrash, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  createAutomationTag,
  defaultAutomationTagColor,
  isHexColor,
  normalizeTagColor,
  normalizeTagName,
  type AutomationTag
} from './automation-tags'

const colorText = (hex: string) => {
  const normalized = normalizeTagColor(hex).slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.62 ? '#111827' : '#f8fafc'
}

export function AutomationTagsInput({
  id,
  label = 'Tags',
  value,
  onChange
}: {
  id: string
  label?: string
  value: AutomationTag[]
  onChange: (tags: AutomationTag[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [openTag, setOpenTag] = useState<string | null>(null)

  const commitDraft = () => {
    const name = normalizeTagName(draft)
    if (!name) return
    const exists = value.some(item => item.name.toLowerCase() === name.toLowerCase())
    if (!exists) {
      onChange([...value, createAutomationTag(name)])
      setOpenTag(name)
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

  const updateTag = (sourceName: string, patch: Partial<AutomationTag>) => {
    const sourceKey = sourceName.toLowerCase()
    const current = value.find(item => item.name.toLowerCase() === sourceKey)
    if (!current) return

    const nextName = patch.name !== undefined ? normalizeTagName(patch.name) : current.name
    const nextColor = patch.color !== undefined ? patch.color.trim() : current.color
    if (!nextName) return

    const duplicate = value.some(item => item.name.toLowerCase() === nextName.toLowerCase() && item !== current)
    if (duplicate) return

    onChange(
      value.map(item =>
        item === current
          ? {
              name: nextName,
              color: isHexColor(nextColor) ? nextColor.toLowerCase() : current.color
            }
          : item
      )
    )
    setOpenTag(nextName)
  }

  const removeTag = (tag: AutomationTag) => {
    onChange(value.filter(item => item !== tag))
    setOpenTag(null)
  }

  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <div className='flex min-h-11 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-input px-3 py-2 dark:bg-white/5 focus-visible:border-primary/60 hover:bg-input/84 hover:border-primary/40'>
        {value.map(tag => (
          <Popover
            key={tag.name}
            open={openTag?.toLowerCase() === tag.name.toLowerCase()}
            onOpenChange={open => setOpenTag(open ? tag.name : null)}
          >
            <PopoverTrigger asChild>
              <button
                type='button'
                className='flex max-w-full items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs font-medium shadow-sm transition hover:ring-1 hover:ring-primary/50'
                style={{ backgroundColor: tag.color, color: colorText(tag.color) }}
              >
                <span className='truncate'>{tag.name}</span>
                <IconPalette className='size-3.5 opacity-80' />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align='start'
              className='w-72 p-3'
            >
              <TagEditor
                tag={tag}
                onChange={patch => updateTag(tag.name, patch)}
                onRemove={() => removeTag(tag)}
                onClose={() => setOpenTag(null)}
              />
            </PopoverContent>
          </Popover>
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

function TagEditor({
  tag,
  onChange,
  onRemove,
  onClose
}: {
  tag: AutomationTag
  onChange: (patch: Partial<AutomationTag>) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color || defaultAutomationTagColor)
  const colorValid = isHexColor(color)

  const applyName = () => {
    const nextName = normalizeTagName(name)
    if (nextName) onChange({ name: nextName })
    else setName(tag.name)
  }

  const applyColor = () => {
    if (colorValid) onChange({ color })
    else setColor(tag.color)
  }

  return (
    <div className='grid gap-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>Tag settings</div>
          <div className='truncate text-xs text-secondary-foreground'>{tag.name}</div>
        </div>
        <button
          type='button'
          className='rounded-md p-1 text-secondary-foreground hover:bg-secondary/70 hover:text-foreground'
          aria-label='Close tag settings'
          onClick={onClose}
        >
          <IconX className='size-4' />
        </button>
      </div>
      <div className='grid gap-2'>
        <Label>Name</Label>
        <Input
          value={name}
          maxLength={48}
          onBlur={applyName}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              applyName()
            }
          }}
        />
      </div>
      <div className='grid gap-2'>
        <Label>Color</Label>
        <div className='grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2'>
          <input
            type='color'
            value={colorValid ? color : defaultAutomationTagColor}
            className='h-9 w-10 rounded-md border border-border/70 bg-input p-1'
            aria-label='Tag color'
            onChange={event => {
              setColor(event.target.value)
              onChange({ color: event.target.value })
            }}
          />
          <Input
            value={color}
            placeholder='#64748b'
            onBlur={applyColor}
            onChange={event => setColor(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyColor()
              }
            }}
          />
        </div>
        {!colorValid ? <p className='text-xs text-destructive'>Use a #RRGGBB hex value.</p> : null}
      </div>
      <Button
        type='button'
        variant='ghost'
        className='w-fit gap-2 text-destructive hover:text-destructive'
        onClick={onRemove}
      >
        <IconTrash className='size-4' />
        Remove tag
      </Button>
    </div>
  )
}
