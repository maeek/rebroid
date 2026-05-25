import { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

export const ToolSection = ({
  title,
  description,
  icon,
  actions,
  children,
  className,
  hideHeader
}: {
  title: string
  description?: string
  icon: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  hideHeader?: boolean
}) => (
  <section
    className={cn(
      'flex w-full flex-col gap-4 rounded-lg border border-border/70 bg-card/20 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-md max-sm:p-4',
      className
    )}
  >
    <Visible when={!hideHeader || actions}>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className={cn('flex min-w-0 items-start gap-3', hideHeader && 'sr-only')}>
          <div className='mt-0.5 text-primary'>{icon}</div>
          <div className='min-w-0'>
            <h3 className='font-medium'>{title}</h3>
            <Visible when={description}>
              <p className='mt-1 text-sm text-secondary-foreground'>{description}</p>
            </Visible>
          </div>
        </div>
        <Visible when={actions}>
          <div className='flex shrink-0 flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:justify-start'>
            {actions}
          </div>
        </Visible>
      </div>
    </Visible>
    {children}
  </section>
)
