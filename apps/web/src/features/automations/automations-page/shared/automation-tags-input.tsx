'use client'

import { type InputHTMLAttributes, type KeyboardEvent, type ReactNode, useState } from 'react'
import { DEFAULT_AUTOMATION_TAG_COLOR, type AutomationTag } from '@rebroid/automation-core/definition'
import { IconPalette, IconTrash, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { chipInputSurfaceClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { automationTagStyle, createAutomationTag, isHexColor } from './automation-tags'

export function AutomationTagsInput({
  id,
  label = 'Tags',
  description,
  value,
  onChange
}: {
  id: string
  label?: string
  description?: string
  value: AutomationTag[]
  onChange: (tags: AutomationTag[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [openTag, setOpenTag] = useState<string | null>(null)

  const commitDraft = () => {
    const name = draft.trim()
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

  const updateTag = (current: AutomationTag, patch: Partial<AutomationTag>) => {
    const nextName = patch.name?.trim() ?? current.name
    if (!nextName || value.some(item => item !== current && item.name.toLowerCase() === nextName.toLowerCase())) {
      return false
    }

    const nextColor = patch.color?.trim() ?? current.color
    const color = isHexColor(nextColor) ? nextColor.toLowerCase() : current.color
    onChange(value.map(item => (item === current ? { name: nextName, color } : item)))
    setOpenTag(nextName)
    return true
  }

  const removeTag = (tag: AutomationTag) => {
    onChange(value.filter(item => item !== tag))
    setOpenTag(null)
  }

  return (
    <FormField
      controlId={id}
      label={label}
      field='tags'
      description={description}
      layout='vertical'
    >
      <TagInputControl
        value={draft}
        onBlur={commitDraft}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      >
        {value.map(tag => (
          <Popover
            key={tag.name}
            open={openTag?.toLowerCase() === tag.name.toLowerCase()}
            onOpenChange={open => setOpenTag(open ? tag.name : null)}
          >
            <PopoverTrigger asChild>
              <button
                type='button'
                className='flex max-w-full items-center gap-1 rounded-control border border-white/20 px-2 py-1 text-xs font-medium shadow-xs transition hover:ring-2 hover:ring-ring/35'
                style={automationTagStyle(tag.color)}
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
                onChange={patch => updateTag(tag, patch)}
                onRemove={() => removeTag(tag)}
                onClose={() => setOpenTag(null)}
              />
            </PopoverContent>
          </Popover>
        ))}
      </TagInputControl>
    </FormField>
  )
}

function TagInputControl({ children, ...props }: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-control px-3 py-1 focus-within:ring-2 focus-within:ring-ring',
        chipInputSurfaceClassName
      )}
    >
      {children}
      <input
        {...props}
        className='h-6 min-w-34 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted'
        maxLength={48}
        placeholder='Add tag and press Enter'
      />
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
  onChange: (patch: Partial<AutomationTag>) => boolean
  onRemove: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color || DEFAULT_AUTOMATION_TAG_COLOR)
  const colorValid = isHexColor(color)

  const applyName = () => {
    const nextName = name.trim()
    setName(onChange({ name: nextName }) ? nextName : tag.name)
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
          <div className='truncate text-xs text-foreground-muted'>{tag.name}</div>
        </div>
        <button
          type='button'
          className='rounded-control p-1 text-foreground-muted hover:bg-surface-band/70 hover:text-foreground'
          aria-label='Close tag settings'
          onClick={onClose}
        >
          <IconX className='size-4' />
        </button>
      </div>
      <FormField
        label='Name'
        layout='vertical'
      >
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
      </FormField>
      <div className='grid gap-2'>
        <Label>Color</Label>
        <div className='grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2'>
          <input
            type='color'
            value={colorValid ? color : DEFAULT_AUTOMATION_TAG_COLOR}
            className='h-9 w-10 rounded-control border border-control-border bg-control p-1'
            aria-label='Tag color'
            onChange={event => {
              setColor(event.target.value)
              onChange({ color: event.target.value })
            }}
          />
          <Input
            value={color}
            aria-label='Tag color hex value'
            aria-invalid={!colorValid}
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
        {!colorValid ? <p className='text-xs text-danger'>Use a #RRGGBB hex value.</p> : null}
      </div>
      <Button
        type='button'
        variant='ghost'
        className='w-fit gap-2 text-danger hover:text-danger'
        onClick={onRemove}
      >
        <IconTrash className='size-4' />
        Remove tag
      </Button>
    </div>
  )
}
