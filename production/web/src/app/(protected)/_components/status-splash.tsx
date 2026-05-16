'use client'

import type { ReactNode } from 'react'
import { IconRefresh, IconServerOff } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const StatusSplash = ({
  title,
  description,
  detail,
  icon,
  tone = 'default',
  primaryAction,
  secondaryAction,
  className
}: {
  title: string
  description: string
  detail?: string | null
  icon?: ReactNode
  tone?: 'default' | 'danger'
  primaryAction?: { label: string; href?: string; onClick?: () => void }
  secondaryAction?: { label: string; href?: string; onClick?: () => void }
  className?: string
}) => {
  const renderAction = (action: NonNullable<typeof primaryAction>, variant: 'default' | 'secondary') => {
    const button = (
      <Button
        type='button'
        variant={variant}
        onClick={action.onClick}
      >
        {action.label.toLowerCase().includes('refresh') && <IconRefresh className='size-4' />}
        {action.label}
      </Button>
    )

    return action.href ? <Link href={action.href}>{button}</Link> : button
  }

  return (
    <div
      className={cn(
        'flex min-h-[48vh] items-center justify-center rounded-lg p-8 text-center backdrop-blur-md',
        className
      )}
    >
      <div className='flex max-w-xl flex-col items-center gap-5'>
        <div
          className={cn(
            'flex size-20 items-center justify-center rounded-full bg-secondary/80 text-primary',
            tone === 'danger' && 'bg-destructive/15 text-destructive'
          )}
        >
          {icon ?? <IconServerOff className='size-10' />}
        </div>
        <div className='flex flex-col gap-2'>
          <h2 className='text-2xl font-medium'>{title}</h2>
          <p className='text-secondary-foreground'>{description}</p>
        </div>
        {detail && (
          <p className='w-full rounded-md bg-background/50 p-3 text-xs text-muted-foreground text-center'>{detail}</p>
        )}
        {(primaryAction || secondaryAction) && (
          <div className='flex flex-wrap items-center justify-center gap-3'>
            {primaryAction && renderAction(primaryAction, 'default')}
            {secondaryAction && renderAction(secondaryAction, 'secondary')}
          </div>
        )}
      </div>
    </div>
  )
}
