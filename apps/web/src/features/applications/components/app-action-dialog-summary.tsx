import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
  tone?: 'neutral' | 'warning' | 'danger'
}) => (
  <div className='py-1'>
    <div className='flex items-start gap-4'>
      <div
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', {
          'bg-surface-band/70 text-foreground': tone === 'neutral',
          'bg-warning/12 text-warning': tone === 'warning',
          'bg-danger/12 text-danger': tone === 'danger'
        })}
      >
        {icon}
      </div>
      <div className='min-w-0'>
        <p className='text-base font-medium text-foreground'>{title}</p>
        <p className='mt-1 text-sm leading-5 text-foreground-muted'>{description}</p>
        {details?.length ? (
          <ul className='mt-3 list-disc space-y-1 pl-4 text-xs leading-5 text-foreground-muted'>
            {details.map(detail => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  </div>
)
