'use client'

import type { ReactNode } from 'react'
import {
  IconAlertTriangle,
  IconDatabaseOff,
  IconFilterOff,
  IconLoader2,
  IconMapQuestion,
  IconRefresh,
  IconServerOff
} from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type StateViewKind = 'loading' | 'empty' | 'no-results' | 'not-found' | 'unavailable' | 'error'
export type StateViewScope = 'page' | 'section' | 'grid' | 'immersive'
export type StateViewAction = {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  icon?: ReactNode
}

const defaultIcon = (kind: StateViewKind) => {
  if (kind === 'loading') return <IconLoader2 className='size-10 animate-spin' />
  if (kind === 'empty') return <IconDatabaseOff className='size-10' />
  if (kind === 'no-results') return <IconFilterOff className='size-10' />
  if (kind === 'not-found') return <IconMapQuestion className='size-10' />
  if (kind === 'error') return <IconAlertTriangle className='size-10' />
  return <IconServerOff className='size-10' />
}

const renderAction = (action: StateViewAction, fallbackVariant: 'primary' | 'secondary') => {
  const content = (
    <>
      {action.icon ??
        (action.label === 'Refresh' || action.label === 'Try again' ? <IconRefresh className='size-4' /> : null)}
      {action.label}
    </>
  )

  if (action.href) {
    return (
      <Button
        asChild
        variant={action.variant ?? fallbackVariant}
      >
        <Link href={action.href}>{content}</Link>
      </Button>
    )
  }

  return (
    <Button
      type='button'
      variant={action.variant ?? fallbackVariant}
      onClick={action.onClick}
    >
      {content}
    </Button>
  )
}

export const StateView = ({
  actions,
  className,
  description,
  detail,
  icon,
  kind,
  requestId,
  scope = 'section',
  title
}: {
  actions?: StateViewAction[]
  className?: string
  description: ReactNode
  detail?: ReactNode
  icon?: ReactNode
  kind: StateViewKind
  requestId?: string | null
  scope?: StateViewScope
  title: ReactNode
}) => {
  const Heading = scope === 'page' || scope === 'immersive' ? 'h1' : scope === 'grid' ? 'h3' : 'h2'
  const dangerous = kind === 'error' || kind === 'unavailable'

  return (
    <div
      role={dangerous ? 'alert' : 'status'}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      className={cn(
        'flex w-full items-center justify-center rounded-panel px-6 py-10 text-center',
        {
          'min-h-[calc(100dvh-10rem)]': scope === 'page',
          'min-h-[calc(100dvh-16rem)]': scope === 'section',
          'min-h-48': scope === 'grid',
          'min-h-full': scope === 'immersive'
        },
        className
      )}
    >
      <div className='flex max-w-xl flex-col items-center gap-5'>
        <div
          aria-hidden='true'
          className={cn('flex size-20 items-center justify-center rounded-full bg-surface-band/80 text-primary', {
            'bg-danger/15 text-danger': dangerous
          })}
        >
          {icon ?? defaultIcon(kind)}
        </div>
        <div className='grid gap-2'>
          <Heading className='text-2xl font-medium'>{title}</Heading>
          <p className='text-foreground-muted'>{description}</p>
        </div>
        {detail ? <div className='w-full text-xs text-foreground-muted'>{detail}</div> : null}
        {requestId ? <div className='text-xs text-foreground-muted'>Reference: {requestId}</div> : null}
        {actions?.length ? (
          <div className='flex flex-wrap items-center justify-center gap-3'>
            {actions.map((action, index) => (
              <span key={`${action.label}-${index}`}>
                {renderAction(action, index === 0 ? 'primary' : 'secondary')}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
