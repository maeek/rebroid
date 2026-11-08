import type { ReactNode } from 'react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Section } from '@/components/ui/section'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'

export const AiProvidersPageLayout = ({
  actions,
  providers,
  suggestions
}: {
  actions?: ReactNode
  providers: ReactNode
  suggestions: ReactNode
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Platform', href: '/platform' }}
      title='AI'
      leading={<GradientSparklesIcon className='size-8 max-sm:size-5' />}
      description='Manage model providers and AI-assisted automation.'
      actions={actions}
    />
    <PageContent>
      <Section
        surface='panel'
        title='Automation assistance'
      >
        {suggestions}
      </Section>
      {providers}
    </PageContent>
  </StandardPage>
)
