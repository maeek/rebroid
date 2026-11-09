'use client'

import type { ReactNode } from 'react'
import {
  IconAlertTriangle,
  IconDatabaseOff,
  IconFilterOff,
  IconInfinity,
  IconLoader2,
  IconMapQuestion,
  IconRefresh,
  IconServerOff
} from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { cn } from '@/lib/utils'
import { StateIllustration } from './state-illustration'

export type StateViewKind =
  'loading' | 'empty' | 'no-results' | 'not-found' | 'unavailable' | 'error' | 'not-applicable'
export type StateViewScope = 'page' | 'section' | 'grid' | 'immersive'
export type StateViewAction = {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  icon?: ReactNode
  pending?: boolean
  pendingLabel?: string
}

const defaultIcon = (kind: StateViewKind) => {
  if (kind === 'loading') return <IconLoader2 className='animate-spin' />
  if (kind === 'empty') return <IconDatabaseOff />
  if (kind === 'no-results') return <IconFilterOff />
  if (kind === 'not-found') return <IconMapQuestion />
  if (kind === 'not-applicable') return <IconInfinity />
  if (kind === 'error') return <IconAlertTriangle />
  return <IconServerOff />
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
    <MutationButton
      type='button'
      variant={action.variant ?? fallbackVariant}
      onClick={action.onClick}
      pending={action.pending}
      pendingLabel={action.pendingLabel}
    >
      {content}
    </MutationButton>
  )
}

export const StateView = ({
  actions,
  className,
  description,
  detail,
  headingLevel,
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
  headingLevel?: 1 | 2 | 3
  icon?: ReactNode
  kind: StateViewKind
  requestId?: string | null
  scope?: StateViewScope
  title: ReactNode
}) => {
  const level = headingLevel ?? (scope === 'page' || scope === 'immersive' ? 1 : 3)
  const Heading: 'h1' | 'h2' | 'h3' = `h${level}`
  const dangerous = kind === 'error' || kind === 'unavailable'
  const compact = scope === 'section'
  const illustrationKind =
    !icon && scope === 'page' && (kind === 'error' || kind === 'unavailable' || kind === 'not-found') ? kind : null
  const illustrated = illustrationKind !== null

  return (
    <div
      role={dangerous ? 'alert' : 'status'}
      data-slot='state-view'
      data-scope={scope}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      className={cn(
        'flex w-full min-w-0',
        {
          'justify-center px-6 py-16 text-center': scope === 'page',
          'py-4 text-left': compact,
          'justify-center px-4 py-8 text-center': scope === 'grid',
          'min-h-full items-center justify-center px-6 py-10 text-center': scope === 'immersive'
        },
        className
      )}
    >
      <div
        className={cn(
          'flex w-full max-w-xl gap-3',
          compact ? 'items-start' : 'flex-col items-center',
          illustrated && 'gap-6'
        )}
      >
        <div
          aria-hidden='true'
          className={cn('shrink-0 text-foreground-muted', !illustrated && '[&>svg]:size-6', {
            'text-danger': dangerous && !illustrated,
            'mt-0.5': compact
          })}
        >
          {illustrationKind ? <StateIllustration kind={illustrationKind} /> : (icon ?? defaultIcon(kind))}
        </div>
        <div className={cn('grid min-w-0 gap-3', !compact && 'justify-items-center')}>
          <div className='grid gap-1'>
            <Heading className={cn('font-medium', scope === 'immersive' || illustrated ? 'text-xl' : 'text-sm')}>
              {title}
            </Heading>
            <div className='text-sm text-foreground-muted [overflow-wrap:anywhere]'>{description}</div>
          </div>
          {detail ? <div className='w-full text-xs text-foreground-muted'>{detail}</div> : null}
          {requestId ? (
            <div className='max-w-full text-xs text-foreground-muted [overflow-wrap:anywhere]'>
              Reference: {requestId}
            </div>
          ) : null}
          {actions?.length ? (
            <div className={cn('flex flex-wrap items-center gap-2', !compact && 'justify-center')}>
              {actions.map((action, index) => (
                <span key={`${action.label}-${index}`}>
                  {renderAction(action, kind === 'empty' && index === 0 ? 'primary' : 'secondary')}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
