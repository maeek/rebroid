import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import styles from './page-toolbar.module.css'

export const PageHeadingRow = ({
  actions,
  children,
  className,
  titleClassName
}: {
  actions?: ReactNode
  children: ReactNode
  className?: string
  titleClassName?: string
}) => (
  <div className={cn('flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2', styles.headingRow, className)}>
    <div
      className={cn(
        'flex min-h-(--page-header-control-size) min-w-0 flex-auto items-center',
        styles.headingTitle,
        titleClassName
      )}
    >
      {children}
    </div>
    {actions ? (
      <div
        className={cn(
          'flex min-h-(--page-header-control-size) min-w-0 max-w-full flex-wrap items-center gap-2 sm:ml-auto sm:justify-end',
          styles.headingActions
        )}
      >
        {actions}
      </div>
    ) : null}
  </div>
)
