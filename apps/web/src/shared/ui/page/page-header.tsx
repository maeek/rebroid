import type { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { PageBreadcrumbs, type PageBreadcrumbItem } from '@/shared/ui/page/page-breadcrumbs'
import { PageHeadingRow } from '@/shared/ui/page/page-heading-row'
import styles from './page-toolbar.module.css'

export const PageHeader = ({
  actions,
  breadcrumbRefresh,
  breadcrumbLabel,
  className,
  description,
  desktopOnlyBreadcrumbRow = false,
  leading,
  section,
  title,
  titleBadge,
  trail = [],
  badges,
  meta
}: {
  actions?: ReactNode
  breadcrumbRefresh?: ReactNode
  breadcrumbLabel?: ReactNode
  className?: string
  description?: ReactNode
  desktopOnlyBreadcrumbRow?: boolean
  leading?: ReactNode
  section?: PageBreadcrumbItem
  title: ReactNode
  titleBadge?: ReactNode
  trail?: PageBreadcrumbItem[]
  badges?: ReactNode
  meta?: ReactNode
}) => {
  const currentLabel = breadcrumbLabel ?? title
  const lastItem = trail.at(-1) ?? section
  const currentAlreadyPresent =
    typeof lastItem?.label === 'string' && typeof currentLabel === 'string' && lastItem.label === currentLabel
  const breadcrumbTrail = [...(section ? [section] : []), ...trail]
  const showBreadcrumbs = breadcrumbTrail.length > 0
  const showBreadcrumbRow = showBreadcrumbs || Boolean(breadcrumbRefresh)
  const breadcrumbs = currentAlreadyPresent
    ? [...breadcrumbTrail.slice(0, -1), { label: currentLabel }]
    : [...breadcrumbTrail, { label: currentLabel }]
  const heading = (
    <h1 className='flex min-w-0 items-center gap-2.5 text-3xl font-medium max-sm:text-2xl'>
      {leading}
      <span className='min-w-0 [overflow-wrap:anywhere]'>{title}</span>
    </h1>
  )

  return (
    <header
      className={cn(
        'shrink-0 px-6 pb-4 max-sm:px-4',
        showBreadcrumbRow ? 'pt-(--page-header-top-inset)' : 'pt-4',
        showBreadcrumbRow && desktopOnlyBreadcrumbRow && 'max-lg:pt-4',
        className
      )}
    >
      <div className='grid grid-cols-[minmax(0,1fr)] gap-3'>
        {showBreadcrumbRow ? (
          <div
            className={cn(
              'flex min-h-(--page-header-control-size) min-w-0 items-center gap-2',
              desktopOnlyBreadcrumbRow && 'max-lg:hidden',
              styles.breadcrumbRow
            )}
          >
            {showBreadcrumbs ? (
              <PageBreadcrumbs
                className='min-w-0 flex-1 pt-0'
                items={breadcrumbs}
              />
            ) : null}
            {breadcrumbRefresh ? (
              <div className={cn('ml-auto shrink-0', styles.breadcrumbRefresh)}>{breadcrumbRefresh}</div>
            ) : null}
          </div>
        ) : null}
        <div
          className={cn(
            'grid grid-cols-[minmax(0,1fr)] gap-2',
            showBreadcrumbs && (desktopOnlyBreadcrumbRow ? 'lg:pt-4' : 'pt-4')
          )}
        >
          <PageHeadingRow actions={actions}>
            {titleBadge ? (
              <div className='flex min-w-0 items-center gap-2.5'>
                {heading}
                <div className='relative top-0.5 flex shrink-0'>{titleBadge}</div>
              </div>
            ) : (
              heading
            )}
          </PageHeadingRow>
          <Visible when={badges || meta}>
            <div className='flex min-w-0 flex-wrap items-center gap-2 text-xs text-foreground-muted'>
              {badges}
              {meta}
            </div>
          </Visible>
          <Visible when={description}>
            <p className='max-w-3xl text-sm text-foreground-muted touch:text-base/6'>{description}</p>
          </Visible>
        </div>
      </div>
    </header>
  )
}
