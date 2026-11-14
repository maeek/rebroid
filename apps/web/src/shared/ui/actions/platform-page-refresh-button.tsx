'use client'

import { useEffect, useState } from 'react'
import { IconCheck, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirmedFeedback } from '@/hooks/use-confirmed-feedback'

export type RefreshResult = { version: unknown; succeeded: boolean }

export const PlatformPageRefreshButton = ({
  isRefreshing,
  onRefresh,
  label = 'Refresh',
  disabled,
  refreshResult
}: {
  isRefreshing?: boolean
  onRefresh: () => void
  label?: string
  disabled?: boolean
  refreshResult?: RefreshResult
}) => {
  const { confirmation, confirm, reset } = useConfirmedFeedback<boolean>()
  const [attempt, setAttempt] = useState<{ version: unknown } | null>(null)
  const version = refreshResult?.version
  const succeeded = refreshResult?.succeeded
  useEffect(() => {
    if (!attempt || isRefreshing) return
    // A finished transition can still contain stale data or an error fallback.
    if (version !== attempt.version && succeeded) confirm(true)
    setAttempt(null)
  }, [attempt, isRefreshing, version, succeeded, confirm])
  let Icon = IconRefresh
  let state = 'idle'
  if (isRefreshing) {
    Icon = IconLoader2
    state = 'pending'
  } else if (confirmation) {
    Icon = IconCheck
    state = 'confirmed'
  }
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon-md'
            aria-label={label}
            aria-busy={isRefreshing || undefined}
            disabled={disabled || isRefreshing}
            onClick={() => {
              reset()
              setAttempt({ version })
              onRefresh()
            }}
          >
            <Icon
              aria-hidden
              data-refresh-state={state}
              className={isRefreshing ? 'size-4 motion-safe:animate-spin' : 'size-4'}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{confirmation && !isRefreshing ? 'Updated' : label}</TooltipContent>
      </Tooltip>
      <span
        aria-live='polite'
        aria-atomic='true'
        className='sr-only'
      >
        {confirmation && !isRefreshing ? 'Updated' : ''}
      </span>
    </>
  )
}
