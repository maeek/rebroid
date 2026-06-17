import { PageHeader } from '@/shared/ui/page/page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { StatusSplash } from '@/shared/ui/status-splash'

export const AutomationPageUnavailable = ({
  title,
  detail,
  href
}: {
  title: string
  detail: string | null
  href: string
}) => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeader
      breadcrumbs={[{ label: 'Automations' }, { label: title }]}
      title={title}
      description='Automation data is temporarily unavailable.'
    />
    <section className='px-6 pb-16 pt-4 max-sm:px-4'>
      <StatusSplash
        title='Automation service unavailable'
        description='The page could not load automation data from the orchestrator.'
        detail={detail}
        tone='danger'
        primaryAction={{ label: 'Refresh', href }}
        secondaryAction={{ label: 'Back to apps', href: '/apps' }}
      />
    </section>
  </ProtectedStackPageLayout>
)
