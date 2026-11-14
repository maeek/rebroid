import { cn } from '@/lib/utils'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'

export const AppResourceBreadcrumbs = ({
  appName = 'Application',
  className
}: {
  appName?: string
  className?: string
}) => (
  <PageBreadcrumbs
    className={cn('pt-0', className)}
    items={[{ label: 'Apps', href: '/apps' }, { label: appName }]}
  />
)
