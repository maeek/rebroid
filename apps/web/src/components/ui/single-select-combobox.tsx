'use client'

import { useMemo, useState } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { IconCheck, IconChevronDown } from '@tabler/icons-react'
import {
  controlSurfaceClassName,
  floatingLayerClassName,
  menuSurfaceClassName,
  selectableItemClassName
} from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { popupFadeClassName } from './feedback-motion'

type Option = { value: string; label: string; description?: string; keywords?: string[]; group?: string }
type OptionGroup = { label: string; items: string[] }
type Props = {
  options: Option[]
  createOption?: (query: string) => Option | null
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  inline?: boolean
  'aria-label'?: string
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export const SingleSelectCombobox = ({
  options,
  createOption,
  value,
  onValueChange,
  disabled,
  inline = false,
  placeholder = 'Search options',
  ...attributes
}: Props) => {
  const [open, setOpen] = useState(false)
  const [typedValue, setTypedValue] = useState('')
  const optionsByValue = useMemo(() => {
    const byValue = new Map(options.map(option => [option.value, option]))
    const candidate = createOption?.(typedValue.trim())
    if (candidate && candidate.value !== value && !byValue.has(candidate.value)) {
      byValue.set(candidate.value, candidate)
    }
    return byValue
  }, [createOption, options, typedValue, value])
  const items = useMemo(() => [...optionsByValue.keys()], [optionsByValue])
  const groups = useMemo(() => {
    if (!options.some(option => option.group)) return null
    const byLabel = new Map<string, string[]>()
    for (const option of optionsByValue.values()) {
      const label = option.group ?? 'Other'
      const members = byLabel.get(label) ?? []
      members.push(option.value)
      byLabel.set(label, members)
    }
    return Array.from(byLabel, ([label, members]) => ({ label, items: members }))
  }, [options, optionsByValue])
  const renderItem = (itemValue: string) => {
    const option = optionsByValue.get(itemValue)
    return (
      <Combobox.Item
        key={itemValue}
        value={itemValue}
        className={cn('relative grid gap-0.5 px-3 py-2 pr-9 text-sm touch:text-base/6', selectableItemClassName)}
      >
        <span className='break-words'>{option?.label ?? itemValue}</span>
        {option?.description ? (
          <span className='text-xs text-foreground-muted touch:text-sm/5'>{option.description}</span>
        ) : null}
        <Combobox.ItemIndicator className='absolute right-3 top-3 text-primary'>
          <IconCheck className='size-4' />
        </Combobox.ItemIndicator>
      </Combobox.Item>
    )
  }
  const list = (
    <>
      <Combobox.Empty className='text-sm text-foreground-muted'>
        <span className='block p-4'>No options found.</span>
      </Combobox.Empty>
      <Combobox.List className='scrollbar-thin max-h-[min(22rem,50dvh)] overflow-y-auto overscroll-contain p-1'>
        {groups
          ? (group: OptionGroup) => (
              <Combobox.Group
                key={group.label}
                items={group.items}
                className='pb-1 [&+&]:border-t [&+&]:border-surface-border/60'
              >
                <Combobox.GroupLabel className='px-3 pt-2 pb-1 text-xs font-medium text-foreground-muted'>
                  {group.label}
                </Combobox.GroupLabel>
                <Combobox.Collection>{renderItem}</Combobox.Collection>
              </Combobox.Group>
            )
          : renderItem}
      </Combobox.List>
    </>
  )
  return (
    <Combobox.Root
      inline={inline}
      inputValue={inline ? typedValue : undefined}
      open={open}
      onOpenChange={nextOpen => {
        setOpen(nextOpen)
        if (!nextOpen) setTypedValue('')
      }}
      onInputValueChange={
        inline || createOption ? (next, { reason }) => setTypedValue(reason === 'input-change' ? next : '') : undefined
      }
      items={groups ?? items}
      value={value || null}
      disabled={disabled}
      autoHighlight
      itemToStringLabel={itemValue => optionsByValue.get(itemValue)?.label ?? itemValue}
      onValueChange={next => {
        if (next !== null) onValueChange(next)
      }}
      filter={(itemValue, query) => {
        const option = optionsByValue.get(itemValue)
        return [option?.label, option?.description, option?.group, ...(option?.keywords ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      }}
    >
      <div className='relative w-full min-w-0'>
        <Combobox.Input
          {...attributes}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(
            'touch-control h-9 w-full min-w-0 rounded-control px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring touch:text-base/6',
            !inline && 'pr-9 touch:pr-11',
            controlSurfaceClassName
          )}
        />
        {!inline ? (
          <Combobox.Trigger
            aria-label='Show options'
            className='touch-control absolute inset-y-0 right-0 flex w-9 items-center justify-center text-foreground-muted'
          >
            <IconChevronDown className='size-4' />
          </Combobox.Trigger>
        ) : null}
      </div>
      {inline ? (
        list
      ) : (
        <Combobox.Portal>
          <Combobox.Positioner
            align='start'
            sideOffset={4}
            className={floatingLayerClassName}
          >
            <Combobox.Popup
              className={cn(
                'w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] overflow-hidden',
                popupFadeClassName,
                menuSurfaceClassName
              )}
            >
              {list}
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      )}
    </Combobox.Root>
  )
}
