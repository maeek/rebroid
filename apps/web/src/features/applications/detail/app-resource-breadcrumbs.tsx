import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { appResourceHref, appResourceLabels, type AppResourceView } from './app-resource-links'

export const AppResourceBreadcrumbs = ({
  appId,
  appName,
  view
}: {
  appId: string
  appName: string
  view: AppResourceView
}) => (
  <PageBreadcrumbs
    items={[
      { label: 'Apps', href: '/apps' },
      { label: appName, href: appResourceHref(appId) },
      ...(view === 'profiles' ? [{ label: 'Configuration', href: appResourceHref(appId, 'configuration') }] : []),
      { label: appResourceLabels[view] }
    ]}
  />
)
