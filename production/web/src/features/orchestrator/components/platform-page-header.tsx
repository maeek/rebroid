import type { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'

export const PlatformPageHeader = ({
  title,
  description,
  actions,
  parent
}: {
  title: string
  description?: string
  actions?: ReactNode
  parent?: { label: string; href: string }
}) => (
  <section className='shrink-0 px-6 py-4 max-sm:px-4'>
    <div className='flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start'>
      <div className='flex flex-col gap-2'>
        <PageBreadcrumbs
          className='pt-0'
          items={[
            { label: 'Settings', href: '/settings/general' },
            { label: 'Orchestrator', href: '/settings/orchestrator' },
            ...(parent ? [parent] : []),
            { label: title }
          ]}
        />
        <div className='flex flex-col gap-2 pt-4'>
          <h2 className='text-3xl font-medium max-sm:text-xl'>{title}</h2>
          <Visible when={description}>
            <p className='max-w-3xl text-sm text-secondary-foreground'>{description}</p>
          </Visible>
        </div>
      </div>
      {actions}
    </div>
  </section>
)
