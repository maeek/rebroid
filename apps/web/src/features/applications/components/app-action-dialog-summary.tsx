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
    className={classNames('rounded-lg border p-4', {
      'border-border/70 bg-background/35': tone === 'neutral',
      'border-amber-500/25 bg-amber-500/8': tone === 'warning',
      'border-destructive/30 bg-destructive/8': tone === 'destructive'
    })}
  >
    <div className='flex items-start gap-3'>
      <div
        className={classNames('flex size-9 shrink-0 items-center justify-center rounded-md border', {
          'border-border/70 bg-secondary/65 text-secondary-foreground': tone === 'neutral',
          'border-amber-500/25 bg-amber-500/10 text-amber-400': tone === 'warning',
          'border-destructive/30 bg-destructive/12 text-destructive': tone === 'destructive'
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
      <ul className='mt-3 grid gap-1 border-t border-border/55 pt-3 text-xs leading-5 text-muted-foreground'>
        {details.map(detail => (
          <li
            key={detail}
            className='flex gap-2'
          >
            <span className='text-primary'>-</span>
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    ) : null}
  </div>
)
