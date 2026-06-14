import type { ReactNode } from 'react'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { StatusSplash } from '@/shared/ui/status-splash'

export const PlatformRouteUnavailable = ({
  title,
  titlePrefix,
  description,
  detail,
  href,
  breadcrumbRoot,
  actionLabel = 'Refresh'
}: {
  title: string
  titlePrefix?: ReactNode
  description: string
  detail: string | null
  href: string
  breadcrumbRoot?: { label: string; href?: string }
  actionLabel?: string
}) => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PlatformPageHeader
      title={title}
      titlePrefix={titlePrefix}
      description={description}
      breadcrumbRoot={breadcrumbRoot}
    />
    <section className='px-6 pb-16 pt-6 max-sm:px-4'>
      <StatusSplash
        title='Service unavailable'
        description='The page could not load data from the orchestrator.'
        detail={detail}
        tone='danger'
        primaryAction={{ label: actionLabel, href }}
        secondaryAction={{ label: 'Back to apps', href: '/apps' }}
        className='min-h-[52vh]'
      />
    </section>
  </ProtectedStackPageLayout>
)
