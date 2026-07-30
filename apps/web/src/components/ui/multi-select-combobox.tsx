'use client'

import * as React from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { IconCheck, IconSearch, IconX } from '@tabler/icons-react'
import {
  chipInputSurfaceClassName,
  floatingLayerClassName,
  floatingSurfaceClassName,
  interactiveItemClassName
} from '@/components/ui/surface'
import { cn } from '@/lib/utils'

export type MultiSelectComboboxOption = {
  value: string
  label: string
  description?: string
  keywords?: string[]
  disabled?: boolean
}

type MultiSelectComboboxProps = {
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  className?: string
  disabled?: boolean
  emptyLabel?: string
  id?: string
  name?: string
  onValueChange: (value: string[]) => void
  options: MultiSelectComboboxOption[]
  placeholder?: string
  value: string[]
}

export const MultiSelectCombobox = ({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  className,
  disabled = false,
  emptyLabel = 'No options found.',
  id,
  name,
  onValueChange,
  options,
  placeholder = 'Search options',
  value
}: MultiSelectComboboxProps) => {
  const [open, setOpen] = React.useState(false)
  const optionsByValue = React.useMemo(() => new Map(options.map(option => [option.value, option])), [options])
  const searchableText = React.useMemo(
    () =>
      new Map(
        options.map(option => [
          option.value,
          [option.label, option.description, ...(option.keywords ?? [])].filter(Boolean).join(' ').toLocaleLowerCase()
        ])
      ),
    [options]
  )

  return (
    <Combobox.Root
      multiple
      name={name}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
      autoHighlight
      items={options.map(option => option.value)}
      value={value}
      onValueChange={onValueChange}
      filter={(optionValue, query) =>
        searchableText.get(optionValue)?.includes(query.trim().toLocaleLowerCase()) ?? false
      }
    >
      <Combobox.Chips
        data-slot='multi-select-combobox'
        className={cn(
          'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-control px-3 py-1.5',
          chipInputSurfaceClassName,
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <Combobox.Value>
          {(selectedValues: string[]) =>
            selectedValues.map(selectedValue => {
              const option = optionsByValue.get(selectedValue)

              return (
                <Combobox.Chip
                  key={selectedValue}
                  className='flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-foreground'
                >
                  <span className='truncate'>{option?.label ?? selectedValue}</span>
                  <Combobox.ChipRemove
                    aria-label={`Remove ${option?.label ?? selectedValue}`}
                    className='rounded-full text-foreground-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
                  >
                    <IconX className='size-3.5' />
                  </Combobox.ChipRemove>
                </Combobox.Chip>
              )
            })
          }
        </Combobox.Value>
        <span className='flex min-w-32 flex-1 items-center gap-2'>
          <IconSearch className='size-4 shrink-0 text-foreground-muted' />
          <Combobox.Input
            id={id}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            className='min-w-20 flex-1 border-0 bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-foreground-muted'
          />
        </span>
      </Combobox.Chips>

      <Combobox.Portal>
        <Combobox.Positioner
          align='start'
          sideOffset={4}
          className={floatingLayerClassName}
        >
          <Combobox.Popup
            className={cn(
              'w-[var(--anchor-width)] min-w-64 max-w-[calc(100vw-2rem)] overflow-hidden data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95',
              floatingSurfaceClassName
            )}
          >
            <Combobox.Empty className='px-3 py-6 text-center text-sm text-foreground-muted'>
              {emptyLabel}
            </Combobox.Empty>
            <Combobox.List className='scrollbar-thin max-h-[min(var(--available-height),20rem)] overflow-y-auto p-1'>
              {(optionValue: string, index: number) => {
                const option = optionsByValue.get(optionValue)

                if (!option) return null

                return (
                  <Combobox.Item
                    key={option.value}
                    index={index}
                    value={option.value}
                    disabled={option.disabled}
                    className={cn(
                      'relative flex cursor-default items-start gap-3 px-3 py-2 pr-9',
                      interactiveItemClassName
                    )}
                  >
                    <span className='grid min-w-0 flex-1 gap-0.5'>
                      <span className='truncate text-sm font-medium'>{option.label}</span>
                      {option.description ? (
                        <span className='text-xs leading-5 text-foreground-muted'>{option.description}</span>
                      ) : null}
                    </span>
                    <Combobox.ItemIndicator className='absolute right-3 top-2.5 text-primary'>
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
