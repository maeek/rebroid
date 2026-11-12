import {
  appResourceHref,
  appResourceLabels,
  type AppResourceView
} from '@/shared/model/applications/app-resource-links'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'

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
    className='pt-0'
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
