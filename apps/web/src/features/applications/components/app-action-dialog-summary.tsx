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
  <div className='py-1'>
    <div className='flex items-start gap-4'>
      <div
        className={classNames('flex size-9 shrink-0 items-center justify-center rounded-full', {
          'bg-secondary/70 text-secondary-foreground': tone === 'neutral',
          'bg-amber-400/12 text-amber-300': tone === 'warning',
          'bg-destructive/12 text-destructive': tone === 'destructive'
        })}
      >
        {icon}
      </div>
      <div className='min-w-0'>
        <p className='text-base font-medium text-foreground'>{title}</p>
        <p className='mt-1 text-sm leading-5 text-muted-foreground'>{description}</p>
        {details?.length ? (
          <ul className='mt-3 list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground'>
            {details.map(detail => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  </div>
)
