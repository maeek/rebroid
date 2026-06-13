import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
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
    <section className='shrink-0 px-6 py-4 max-sm:px-4'>
      <div className='grid gap-3'>
        <PageBreadcrumbs
          className='pt-0'
          items={[{ label: 'Automations' }, { label: title }]}
        />
        <div className='grid gap-2'>
          <h2 className='text-3xl font-medium max-sm:text-xl'>{title}</h2>
          <p className='max-w-3xl text-sm text-foreground-muted'>Automation data is temporarily unavailable.</p>
        </div>
      </div>
    </section>
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
