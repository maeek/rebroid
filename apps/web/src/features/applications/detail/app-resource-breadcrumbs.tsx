import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { appResourceHref, appResourceLabels, type AppResourceView } from './app-resource-links'

export const AppResourceBreadcrumbs = ({
  appId,
  appName = 'Application',
  view
}: {
  appId?: string
  appName?: string
  view: AppResourceView
}) => (
  <PageBreadcrumbs
    items={[
      { label: 'Apps', href: '/apps' },
      { label: appName, href: appId ? appResourceHref(appId) : undefined },
      ...(view === 'profiles'
        ? [{ label: 'Configuration', href: appId ? appResourceHref(appId, 'configuration') : undefined }]
        : []),
      { label: appResourceLabels[view] }
    ]}
  />
)
