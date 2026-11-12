import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage, PageContent } from '@/shared/ui/page/page-layout'
import { PageLoadFailure } from '@/shared/ui/page/page-load-failure'

export const AutomationPageUnavailable = ({ title, workflow = false }: { title: string; workflow?: boolean }) => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Automations' }}
      trail={workflow ? [{ label: 'Workflows', href: '/automations' }] : undefined}
      title={title}
      description='Automation data is temporarily unavailable.'
    />
    <PageContent>
      <PageLoadFailure
        title='Automation service unavailable'
        description='The page could not load automation data from the orchestrator.'
        backAction={{ label: 'Go to overview', href: '/platform' }}
      />
    </PageContent>
  </StandardPage>
)
