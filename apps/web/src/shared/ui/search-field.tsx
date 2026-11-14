'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { IconLoader2, IconSearch, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type SearchFieldProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  value: string
  placeholder: string
  onValueChange: (value: string) => void
  onSearch?: (value: string) => void | Promise<void>
  debounceMs?: number
  pending?: boolean
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
  pending = false,
  disabled = false,
  className,
  ariaLabel,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid
}: SearchFieldProps) => {
  const [isSearching, startSearch] = useTransition()
  const [showPending, setShowPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = pending || isSearching
  useEffect(() => {
    if (!busy) {
      setShowPending(false)
      return
    }
    const timer = setTimeout(() => setShowPending(true), 200)
    return () => clearTimeout(timer)
  }, [busy])

  const [pointerHover, setPointerHover] = useState(false)
  const lastCommittedValue = useRef(value)
  const pendingTimeout = useRef<number | null>(null)

  useEffect(() => {
    if (!onSearch || value === lastCommittedValue.current) return

    pendingTimeout.current = window.setTimeout(() => {
      lastCommittedValue.current = value
      pendingTimeout.current = null
      startSearch(() => onSearch(value))
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
    startSearch(() => onSearch?.(nextValue))
  }

  const SearchIcon = busy && showPending ? IconLoader2 : IconSearch

  return (
    <div
      className={cn('relative w-full', className)}
      data-slot='search-field'
      data-has-value={value ? '' : undefined}
      data-pointer-hover={pointerHover ? '' : undefined}
      onPointerMove={event => {
        // A pointer event can arrive over a newly mounted field at the same coordinates.
        if (!pointerHover && event.pointerType !== 'touch' && (event.movementX || event.movementY)) {
          setPointerHover(true)
        }
      }}
      onPointerLeave={() => setPointerHover(false)}
      onPointerCancel={() => setPointerHover(false)}
    >
      <SearchIcon
        aria-hidden='true'
        data-testid='search-field-icon'
        className={cn(
          'pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground-muted',
          busy && showPending && 'motion-safe:animate-spin'
        )}
      />
      <Input
        ref={inputRef}
        aria-busy={busy || undefined}
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        type='search'
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className='pl-9 pr-9 touch:pr-12 [&::-webkit-search-cancel-button]:hidden'
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
            inputRef.current?.focus()
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
