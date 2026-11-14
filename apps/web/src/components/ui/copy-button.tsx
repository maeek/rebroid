'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { IconCheck, IconCopy, IconExclamationCircle, IconLoader2 } from '@tabler/icons-react'
import { ActionStateContent } from '@/components/ui/action-state-content'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'

type CopyStatus = 'idle' | 'pending' | 'copied' | 'failed'
type CopyButtonProps = Omit<ComponentProps<typeof Button>, 'children' | 'onClick' | 'asChild'> & {
  value: string
  label?: string
  iconOnly?: boolean
}

export const CopyButton = ({ value, label = 'Copy', iconOnly = false, size, disabled, ...props }: CopyButtonProps) => {
  const [feedback, setFeedback] = useState<{ value: string; status: CopyStatus }>({ value, status: 'idle' })
  const attempt = useRef(0)
  const busy = useRef(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const status = feedback.value === value ? feedback.status : 'idle'

  useEffect(
    () => () => {
      attempt.current += 1
      busy.current = false
      clearTimeout(timeout.current)
    },
    [value]
  )

  const copy = async () => {
    if (busy.current) return
    busy.current = true
    const currentAttempt = ++attempt.current
    clearTimeout(timeout.current)
    setFeedback({ value, status: 'pending' })
    try {
      await navigator.clipboard.writeText(value)
      if (attempt.current !== currentAttempt) return
      setFeedback({ value, status: 'copied' })
    } catch {
      if (attempt.current !== currentAttempt) return
      setFeedback({ value, status: 'failed' })
      toast({
        title: 'Could not copy',
        description: 'The browser did not allow clipboard access. Try again.',
        variant: 'danger'
      })
    } finally {
      if (attempt.current === currentAttempt) {
        busy.current = false
        timeout.current = setTimeout(() => setFeedback({ value, status: 'idle' }), 1600)
      }
    }
  }

  let message = props['aria-label'] ?? label
  if (status === 'copied') message = 'Copied'
  if (status === 'pending') message = 'Copying…'
  if (status === 'failed') message = 'Copy failed. Try again.'

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size={size ?? (iconOnly ? 'icon-sm' : 'sm')}
            {...props}
            aria-label={message}
            aria-busy={status === 'pending' || undefined}
            data-feedback-active={status !== 'idle' || undefined}
            disabled={disabled || status === 'pending'}
            onClick={() => void copy()}
          >
            <ActionStateContent
              state={status}
              states={[
                {
                  key: 'idle',
                  content: (
                    <IconCopy
                      aria-hidden
                      className='size-4'
                    />
                  )
                },
                {
                  key: 'pending',
                  content: (
                    <IconLoader2
                      aria-hidden
                      className='size-4 motion-safe:animate-spin'
                    />
                  )
                },
                {
                  key: 'copied',
                  content: (
                    <IconCheck
                      aria-hidden
                      className='size-4 text-success'
                    />
                  )
                },
                {
                  key: 'failed',
                  content: (
                    <IconExclamationCircle
                      aria-hidden
                      className='size-4 text-danger'
                    />
                  )
                }
              ]}
            />
            {!iconOnly && label}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{message}</TooltipContent>
      </Tooltip>
      <span
        role='status'
        className='sr-only'
      >
        {status === 'copied' ? 'Copied to clipboard' : ''}
      </span>
    </>
  )
}
