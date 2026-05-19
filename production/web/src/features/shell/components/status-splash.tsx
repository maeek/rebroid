'use client'

import type { ReactNode } from 'react'
import { IconRefresh, IconServerOff } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
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
        <Visible when={action.label.toLowerCase().includes('refresh')}>
          <IconRefresh className='size-4' />
        </Visible>
        {action.label}
      </Button>
    )

    return action.href ? <Link href={action.href}>{button}</Link> : button
  }

  const primaryActionContent = primaryAction ? renderAction(primaryAction, 'default') : null
  const secondaryActionContent = secondaryAction ? renderAction(secondaryAction, 'secondary') : null

  return (
    <div
      className={cn(
        'flex min-h-[48vh] items-center justify-center rounded-lg p-8 text-center backdrop-blur-md',
        className
      )}
    >
      <div className='flex max-w-xl flex-col items-center gap-5'>
        <div
          className={cn('flex size-20 items-center justify-center rounded-full bg-secondary/80 text-primary', {
            'bg-destructive/15 text-destructive': tone === 'danger'
          })}
        >
          {icon ?? <IconServerOff className='size-10' />}
        </div>
        <div className='flex flex-col gap-2'>
          <h2 className='text-2xl font-medium'>{title}</h2>
          <p className='text-secondary-foreground'>{description}</p>
        </div>
        <Visible when={detail}>
          <p className='w-full rounded-md bg-background/50 p-3 text-xs text-muted-foreground text-center'>{detail}</p>
        </Visible>
        <Visible when={primaryAction || secondaryAction}>
          <div className='flex flex-wrap items-center justify-center gap-3'>
            <Visible when={primaryAction}>{primaryActionContent}</Visible>
            <Visible when={secondaryAction}>{secondaryActionContent}</Visible>
          </div>
        </Visible>
      </div>
    </div>
  )
}
