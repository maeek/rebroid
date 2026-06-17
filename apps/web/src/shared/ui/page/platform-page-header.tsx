import type { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'

export const PlatformPageHeader = ({
  title,
  titlePrefix,
  description,
  actions,
  parent,
  breadcrumbRoot = { label: 'Platform', href: '/platform' }
}: {
  title: string
  titlePrefix?: ReactNode
  description?: string
  actions?: ReactNode
  parent?: { label: string; href: string }
  breadcrumbRoot?: { label: string; href?: string }
}) => (
  <section className='shrink-0 px-6 py-4 max-sm:px-4'>
    <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
      <div className='flex flex-col gap-2'>
        <PageBreadcrumbs
          className='pt-0'
          items={[...(breadcrumbRoot ? [breadcrumbRoot] : []), ...(parent ? [parent] : []), { label: title }]}
        />
        <div className='flex flex-col gap-2 pt-4'>
          <h2 className='flex items-center gap-2.5 text-3xl font-medium max-sm:text-xl'>
            {titlePrefix}
            <span>{title}</span>
          </h2>
          <Visible when={description}>
            <p className='max-w-3xl text-sm text-foreground-muted'>{description}</p>
          </Visible>
        </div>
      </div>
      {actions}
    </div>
  </section>
)
