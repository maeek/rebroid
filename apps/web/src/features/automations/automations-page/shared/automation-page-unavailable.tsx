import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage, PageContent } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'

export const AutomationPageUnavailable = ({ title, href }: { title: string; href: string }) => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Automations' }}
      title={title}
      description='Automation data is temporarily unavailable.'
    />
    <PageContent>
      <StateView
        kind='unavailable'
        title='Automation service unavailable'
        description='The page could not load automation data from the orchestrator.'
        actions={[
          { label: 'Refresh', href },
          { label: 'Back to workflows', href: '/automations' }
        ]}
      />
    </PageContent>
  </StandardPage>
)
