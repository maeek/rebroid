import type { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { PageBreadcrumbRow, PageBreadcrumbs, type PageBreadcrumbItem } from '@/shared/ui/page/page-breadcrumbs'
import { PageHeadingRow } from '@/shared/ui/page/page-heading-row'
import styles from './page-toolbar.module.css'

export const compactPageActionClassName = styles.compactPageAction

type PageHeaderProps = {
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
}

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
  meta,
  compact,
  inlineActions = false
}: PageHeaderProps & { compact?: boolean; inlineActions?: boolean }) => {
  const currentLabel = breadcrumbLabel ?? title
  const lastItem = trail.at(-1) ?? section
  const currentAlreadyPresent =
    typeof lastItem?.label === 'string' && typeof currentLabel === 'string' && lastItem.label === currentLabel
  const breadcrumbTrail = [...(section ? [section] : []), ...trail]
  const showBreadcrumbs = breadcrumbTrail.length > 0
  const showBreadcrumbRow = showBreadcrumbs || Boolean(breadcrumbRefresh)
  const showCompactTitle =
    compact ??
    (showBreadcrumbs &&
      !desktopOnlyBreadcrumbRow &&
      typeof title === 'string' &&
      title === currentLabel &&
      !leading &&
      !titleBadge &&
      !badges &&
      !meta)
  const breadcrumbs = currentAlreadyPresent
    ? [...breadcrumbTrail.slice(0, -1), { label: currentLabel }]
    : [...breadcrumbTrail, { label: currentLabel }]
  const heading = (
    <h1
      aria-label={
        showCompactTitle && typeof title !== 'string' && typeof currentLabel === 'string' ? currentLabel : undefined
      }
      className='flex min-w-0 items-center gap-2.5 text-3xl font-medium max-sm:text-2xl'
    >
      {leading}
      <span className='min-w-0 [overflow-wrap:anywhere]'>{title}</span>
    </h1>
  )

  return (
    <header
      className={cn(
        'shrink-0 px-(--page-inline-gutter) pb-4',
        showBreadcrumbRow ? 'pt-(--page-header-top-inset)' : 'pt-4',
        showBreadcrumbRow && desktopOnlyBreadcrumbRow && 'max-lg:pt-4',
        showCompactTitle && styles.compactHeader,
        showCompactTitle && inlineActions && styles.inlineHeaderActions,
        className
      )}
    >
      <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-3', styles.headerLayout)}>
        {showBreadcrumbRow ? (
          <PageBreadcrumbRow className={cn(desktopOnlyBreadcrumbRow && 'max-lg:hidden', styles.breadcrumbRow)}>
            {showBreadcrumbs ? (
              <PageBreadcrumbs
                className='min-w-0 flex-1'
                items={breadcrumbs}
              />
            ) : null}
            {breadcrumbRefresh ? (
              <div
                className={cn(
                  'ml-auto flex min-h-(--page-header-control-size) shrink-0 items-center',
                  styles.breadcrumbRefresh
                )}
              >
                {breadcrumbRefresh}
              </div>
            ) : null}
          </PageBreadcrumbRow>
        ) : null}
        <div
          className={cn(
            'grid grid-cols-[minmax(0,1fr)] gap-2',
            showBreadcrumbs && (desktopOnlyBreadcrumbRow ? 'lg:pt-4' : 'sm:pt-4'),
            styles.headerDetails
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
            <div
              className={cn(
                'flex min-w-0 flex-wrap items-center gap-2 text-xs text-foreground-muted',
                styles.headerMeta
              )}
            >
              {badges}
              {meta}
            </div>
          </Visible>
          <Visible when={description}>
            <p className={cn('max-w-3xl text-sm text-foreground-muted touch:text-base/6', styles.headerDescription)}>
              {description}
            </p>
          </Visible>
        </div>
      </div>
    </header>
  )
}

export const CompactPageHeader = (
  props: Omit<PageHeaderProps, 'desktopOnlyBreadcrumbRow' | 'titleBadge'> & {
    section: PageBreadcrumbItem
    inlineActions?: boolean
  }
) => (
  <PageHeader
    {...props}
    compact
  />
)
