import type { ReactNode } from 'react'
import { PageHeader } from '@/shared/ui/page/page-header'

export const PlatformPageHeader = ({
  title,
  titlePrefix,
  description,
  actions,
  parent,
  breadcrumbRoot = { label: 'Platform', href: '/platform' }
}: {
  title: ReactNode
  titlePrefix?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  parent?: { label: string; href: string }
  breadcrumbRoot?: { label: string; href?: string }
}) => (
  <PageHeader
    breadcrumbs={[...(breadcrumbRoot ? [breadcrumbRoot] : []), ...(parent ? [parent] : []), { label: title }]}
    title={title}
    titlePrefix={titlePrefix}
    description={description}
    actions={actions}
  />
)
