'use client'

import { useSyncExternalStore } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const subscribe = () => () => undefined
const clientSnapshot = () => true
const serverSnapshot = () => false

export const DateTimeValue = ({
  value,
  className,
  compact = false,
  showSeconds = false,
  emptyLabel = 'No timestamp recorded'
}: {
  value: string | null
  className?: string
  compact?: boolean
  showSeconds?: boolean
  emptyLabel?: string
}) => {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  if (!value)
    return (
      <span
        aria-label={emptyLabel}
        className={cn('text-foreground-subtle', className)}
      >
        —
      </span>
    )
  if (!hydrated) return <Skeleton className='h-4 w-28' />
  const date = new Date(value)
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hourCycle: 'h23'
  })
  const full = date.toLocaleString(undefined, { timeZoneName: 'long' })
  return (
    <time
      dateTime={value}
      title={full}
      aria-label={full}
      className={cn(compact ? 'text-xs tabular-nums text-foreground-muted' : 'grid gap-1 tabular-nums', className)}
    >
      {compact ? (
        `${day} · ${time}`
      ) : (
        <>
          <span>{day}</span>
          <span className='text-xs text-foreground-muted'>{time}</span>
        </>
      )}
    </time>
  )
}
