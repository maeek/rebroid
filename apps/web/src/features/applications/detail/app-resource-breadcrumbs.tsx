import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'

export const AppResourceBreadcrumbs = ({ appName = 'Application' }: { appName?: string }) => (
  <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: appName }]} />
)
