'use client'

import { useEffect, useRef } from 'react'
import { IconSearch, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type SearchFieldProps = {
  value: string
  placeholder: string
  onValueChange: (value: string) => void
  onSearch?: (value: string) => void
  debounceMs?: number
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

export const SearchField = ({
  value,
  placeholder,
  onValueChange,
  onSearch,
  debounceMs = 300,
  disabled = false,
  className,
  ariaLabel
}: SearchFieldProps) => {
  const lastCommittedValue = useRef(value)
  const pendingTimeout = useRef<number | null>(null)

  useEffect(() => {
    if (!onSearch || value === lastCommittedValue.current) return

    pendingTimeout.current = window.setTimeout(() => {
      lastCommittedValue.current = value
      pendingTimeout.current = null
      onSearch(value)
    }, debounceMs)

    return () => {
      if (pendingTimeout.current !== null) window.clearTimeout(pendingTimeout.current)
      pendingTimeout.current = null
    }
  }, [debounceMs, onSearch, value])

  const commit = (nextValue: string) => {
    if (pendingTimeout.current !== null) window.clearTimeout(pendingTimeout.current)
    pendingTimeout.current = null
    lastCommittedValue.current = nextValue
    onSearch?.(nextValue)
  }

  return (
    <div className={cn('relative w-full', className)}>
      <IconSearch
        aria-hidden='true'
        data-testid='search-field-icon'
        className='pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground-muted'
      />
      <Input
        type='search'
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className='pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden'
        disabled={disabled}
        onChange={event => onValueChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit(value)
          }
        }}
      />
      {value ? (
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          className='absolute right-1 top-1/2 size-7 -translate-y-1/2'
          aria-label='Clear search'
          disabled={disabled}
          onClick={() => {
            onValueChange('')
            commit('')
          }}
        >
          <IconX className='size-4' />
        </Button>
      ) : null}
    </div>
  )
}
