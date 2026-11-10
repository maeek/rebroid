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

type Option = { value: string; label: string; description?: string; keywords?: string[] }
type Props = {
  options: Option[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export const SingleSelectCombobox = ({
  options,
  value,
  onValueChange,
  disabled,
  placeholder = 'Search options',
  ...attributes
}: Props) => {
  const [open, setOpen] = useState(false)
  const optionsByValue = useMemo(() => new Map(options.map(option => [option.value, option])), [options])
  const items = useMemo(() => options.map(option => option.value), [options])
  return (
    <Combobox.Root
      open={open}
      onOpenChange={setOpen}
      items={items}
      value={value}
      disabled={disabled}
      autoHighlight
      itemToStringLabel={itemValue => optionsByValue.get(itemValue)?.label ?? itemValue}
      onValueChange={next => {
        if (next !== null) onValueChange(next)
      }}
      filter={(itemValue, query) => {
        const option = optionsByValue.get(itemValue)
        return [option?.label, option?.description, ...(option?.keywords ?? [])]
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
            'touch-control h-9 w-full min-w-0 rounded-control pl-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring touch:pr-11 touch:text-base/6',
            controlSurfaceClassName
          )}
        />
        <Combobox.Trigger
          aria-label='Show options'
          className='touch-control absolute inset-y-0 right-0 flex w-9 items-center justify-center text-foreground-muted'
        >
          <IconChevronDown className='size-4' />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner
          align='start'
          sideOffset={4}
          className={floatingLayerClassName}
        >
          <Combobox.Popup
            className={cn('w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] overflow-hidden', menuSurfaceClassName)}
          >
            <Combobox.Empty className='text-sm text-foreground-muted'>
              <span className='block p-4'>No options found.</span>
            </Combobox.Empty>
            <Combobox.List className='max-h-80 overflow-y-auto p-1'>
              {(itemValue: string) => {
                const option = optionsByValue.get(itemValue)
                return (
                  <Combobox.Item
                    key={itemValue}
                    value={itemValue}
                    className={cn(
                      'relative grid gap-0.5 px-3 py-2 pr-9 text-sm touch:text-base/6',
                      selectableItemClassName
                    )}
                  >
                    <span className='break-all'>{option?.label ?? itemValue}</span>
                    <span className='text-xs text-foreground-muted touch:text-sm/5'>{option?.description}</span>
                    <Combobox.ItemIndicator className='absolute right-3 top-3 text-primary'>
                      <IconCheck className='size-4' />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )
              }}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
