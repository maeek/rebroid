import type { ReactNode } from 'react'
import { IconCube, IconPlugConnected } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { ResourceNavigation } from '@/shared/ui/resource-navigation'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'

export type ProviderEditorView = 'models' | 'connection'

export const ProviderEditorLayout = ({
  provider,
  view,
  actions,
  health,
  children,
  loading = false
}: {
  provider: Pick<AutomationAiProvider, 'id' | 'label' | 'enabled'>
  view: ProviderEditorView
  loading?: boolean
  actions?: ReactNode
  health?: ReactNode
  children: ReactNode
}) => {
  const availability = provider.enabled ? 'Available for automation' : 'Disabled for automation'
  const href = `/platform/ai/${encodeURIComponent(provider.id)}`
  return (
    <EditorPage className='gap-2'>
      <PageHeader
        section={{ label: 'Platform', href: '/platform' }}
        trail={[
          { label: 'AI', href: '/platform/ai' },
          { label: provider.label, href }
        ]}
        title={loading ? <Skeleton className='h-9 w-48 max-w-[50vw] max-sm:h-7' /> : provider.label}
        breadcrumbLabel={view === 'models' ? 'Models' : 'Connection'}
        leading={<GradientSparklesIcon className='size-8 max-sm:size-5' />}
        meta={loading ? <Skeleton className='h-4 w-40' /> : availability}
        actions={actions}
      />
      <PageContent>
        <ResourceNavigation
          label='AI provider navigation'
          items={[
            {
              id: 'models',
              label: 'Models',
              icon: <IconCube className='size-3.5' />,
              href: loading ? undefined : href,
              current: view === 'models'
            },
            {
              id: 'connection',
              label: 'Connection',
              icon: <IconPlugConnected className='size-3.5' />,
              href: loading ? undefined : `${href}?view=connection`,
              current: view === 'connection'
            }
          ]}
        />
        {health}
        {children}
      </PageContent>
    </EditorPage>
  )
}
