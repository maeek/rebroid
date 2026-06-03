import type { ReactNode } from 'react'
import classNames from 'classnames'

export const AppActionDialogSummary = ({
  icon,
  title,
  description,
  details,
  tone = 'neutral'
}: {
  icon: ReactNode
  title: string
  description: string
  details?: string[]
  tone?: 'neutral' | 'warning' | 'destructive'
}) => (
  <div
    className={classNames('rounded-md border-l-2 py-1 pl-4 pr-2', {
      'border-l-border/70': tone === 'neutral',
      'border-l-amber-400/80': tone === 'warning',
      'border-l-destructive/80': tone === 'destructive'
    })}
  >
    <div className='flex items-start gap-3'>
      <div
        className={classNames('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md', {
          'text-secondary-foreground': tone === 'neutral',
          'text-amber-300': tone === 'warning',
          'text-destructive': tone === 'destructive'
        })}
      >
        {icon}
      </div>
      <div className='min-w-0'>
        <p className='font-medium text-foreground'>{title}</p>
        <p className='mt-1 text-sm leading-5 text-muted-foreground'>{description}</p>
      </div>
    </div>
    {details?.length ? (
      <ul className='ml-11 mt-2 grid gap-1 text-xs leading-5 text-muted-foreground'>
        {details.map(detail => (
          <li
            key={detail}
            className='flex gap-2'
          >
            <span className='text-muted-foreground'>-</span>
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    ) : null}
  </div>
)
