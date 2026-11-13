'use client'

import type { ReactNode } from 'react'
import { IconCheck, IconLoader2 } from '@tabler/icons-react'
import { ActionStateContent } from '@/components/ui/action-state-content'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import styles from './action-motion.module.css'

type MutationButtonProps = React.ComponentProps<typeof Button> & {
  pending?: boolean
  pendingLabel?: ReactNode
  success?: boolean
  successLabel?: ReactNode
  animate?: boolean
}

export const MutationButton = ({
  children,
  disabled,
  className,
  pending = false,
  pendingLabel,
  success,
  successLabel = 'Saved',
  animate = success !== undefined,
  ...props
}: MutationButtonProps) => {
  let state = 'idle'
  if (success) state = 'success'
  if (pending) state = 'pending'
  const pendingContent = (
    <>
      <IconLoader2
        aria-hidden
        className={cn('size-4', pending && 'motion-safe:animate-spin')}
      />
      {pendingLabel ?? children}
    </>
  )
  const states = [
    { key: 'idle', content: children },
    { key: 'pending', content: pendingContent }
  ]
  if (success !== undefined)
    states.push({
      key: 'success',
      content: (
        <>
          <IconCheck
            aria-hidden
            className='size-4'
          />
          {successLabel}
        </>
      )
    })

  return (
    <Button
      className={cn(animate && styles.control, className)}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      {...props}
    >
      {animate ? (
        <ActionStateContent
          state={state}
          states={states}
        />
      ) : (
        <>{states.find(item => item.key === state)?.content}</>
      )}
    </Button>
  )
}
