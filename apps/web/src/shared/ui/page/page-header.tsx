import type { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { PageBreadcrumbs, type PageBreadcrumbItem } from '@/shared/ui/page/page-breadcrumbs'

export const PageHeader = ({
  actions,
  breadcrumbLabel,
  className,
  description,
  leading,
  section,
  title,
  trail = [],
  badges,
  meta
}: {
  actions?: ReactNode
  breadcrumbLabel?: ReactNode
  className?: string
  description?: ReactNode
  leading?: ReactNode
  section: PageBreadcrumbItem
  title: ReactNode
  trail?: PageBreadcrumbItem[]
  badges?: ReactNode
  meta?: ReactNode
}) => {
  const currentLabel = breadcrumbLabel ?? title
  const lastItem = trail.at(-1) ?? section
  const currentAlreadyPresent =
    typeof lastItem.label === 'string' && typeof currentLabel === 'string' && lastItem.label === currentLabel
  const breadcrumbTrail = [section, ...trail]
  const breadcrumbs = currentAlreadyPresent
    ? [...breadcrumbTrail.slice(0, -1), { label: currentLabel }]
    : [...breadcrumbTrail, { label: currentLabel }]

  return (
    <header className={cn('shrink-0 px-6 py-4 max-sm:px-4', className)}>
      <div className='grid gap-3'>
        <PageBreadcrumbs
          className='pt-0'
          items={breadcrumbs}
        />
        <div className='grid gap-2 pt-4'>
          <div className='flex min-w-0 flex-wrap items-center justify-between gap-3 max-sm:items-start'>
            <h1 className='flex min-w-0 flex-1 items-center gap-2.5 text-3xl font-medium max-sm:text-xl'>
              {leading}
              <span className='min-w-0 truncate'>{title}</span>
            </h1>
            <Visible when={actions}>
              <div className='flex shrink-0 flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:justify-start'>
                {actions}
              </div>
            </Visible>
          </div>
          <Visible when={badges || meta}>
            <div className='flex min-w-0 flex-wrap items-center gap-2 text-xs text-foreground-muted'>
              {badges}
              {meta}
            </div>
          </Visible>
          <Visible when={description}>
            <p className='max-w-3xl text-sm text-foreground-muted'>{description}</p>
          </Visible>
        </div>
      </div>
    </header>
  )
}
