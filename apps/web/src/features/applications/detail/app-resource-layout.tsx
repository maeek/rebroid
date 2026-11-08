import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PageContent } from '@/shared/ui/page/page-layout'

export const AppResourceLayout = ({
  heading,
  breadcrumbs,
  navigation,
  status,
  children,
  workspace = false
}: {
  heading: ReactNode
  breadcrumbs: ReactNode
  navigation: ReactNode
  status: ReactNode
  children: ReactNode
  workspace?: boolean
}) => (
  <PageContent className={cn(workspace && 'pb-4 lg:h-full lg:min-h-0')}>
    <div className='shrink-0'>{breadcrumbs}</div>
    <div className='shrink-0'>{heading}</div>
    <div className='shrink-0'>{navigation}</div>
    {status ? <div className='shrink-0'>{status}</div> : null}
    {workspace ? <div className='flex min-h-0 flex-1 flex-col'>{children}</div> : children}
  </PageContent>
)

export const AppResourceOverviewLayout = ({ summary, actions }: { summary: ReactNode; actions: ReactNode }) => (
  <div className='grid items-start gap-6 '>
    {summary}
    {actions}
  </div>
)
