import type { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { PageBreadcrumbs, type PageBreadcrumbItem } from '@/shared/ui/page/page-breadcrumbs'

export const PageHeader = ({
  actions,
  breadcrumbs,
  className,
  description,
  title,
  titleActions,
  titlePrefix
}: {
  actions?: ReactNode
  breadcrumbs: PageBreadcrumbItem[]
  className?: string
  description?: string
  title: string
  titleActions?: ReactNode
  titlePrefix?: ReactNode
}) => (
  <section className={cn('shrink-0 px-6 py-4 max-sm:px-4', className)}>
    <div className='grid gap-3'>
      <PageBreadcrumbs
        className='pt-0'
        items={breadcrumbs}
      />
      <div className='grid gap-2 pt-4'>
        <div className='flex min-w-0 items-center justify-between gap-3'>
          <h2 className='flex min-w-0 items-center gap-2.5 text-3xl font-medium max-sm:text-xl'>
            {titlePrefix}
            <span className='min-w-0 truncate'>{title}</span>
          </h2>
          <Visible when={titleActions}>
            <div className='flex shrink-0 items-center gap-2'>{titleActions}</div>
          </Visible>
        </div>
        <Visible when={description}>
          <p className='max-w-3xl text-sm text-foreground-muted'>{description}</p>
        </Visible>
        <Visible when={actions}>
          <div className='flex flex-wrap items-center gap-2 pt-1'>{actions}</div>
        </Visible>
      </div>
    </div>
  </section>
)
