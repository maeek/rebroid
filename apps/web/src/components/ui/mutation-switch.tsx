'use client'

import { useId, type ComponentProps } from 'react'
import { IconCheck, IconLoader2 } from '@tabler/icons-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { fieldFeedbackClassName } from './feedback-motion'

export const MutationSwitch = ({
  pending = false,
  success = false,
  disabled,
  ...props
}: ComponentProps<typeof Switch> & {
  pending?: boolean
  success?: boolean
}) => {
  const statusId = useId()
  let message = ''
  if (success) message = 'Saved'
  if (pending) message = 'Saving…'
  return (
    <span
      data-slot='mutation-switch'
      className='inline-flex shrink-0 items-center gap-2'
    >
      <Switch
        {...props}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        aria-describedby={[props['aria-describedby'], statusId].filter(Boolean).join(' ')}
      />
      <span
        className='relative size-4 shrink-0'
        aria-hidden
      >
        <span
          data-visible={pending}
          className={cn('absolute inset-0 text-foreground-muted', fieldFeedbackClassName)}
        >
          <IconLoader2 className={cn('size-4', pending && 'motion-safe:animate-spin')} />
        </span>
        <span
          data-visible={success && !pending}
          className={cn('absolute inset-0 text-success', fieldFeedbackClassName)}
        >
          <IconCheck className='size-4' />
        </span>
      </span>
      <span
        id={statusId}
        role='status'
        className='sr-only'
      >
        {message}
      </span>
    </span>
  )
}
