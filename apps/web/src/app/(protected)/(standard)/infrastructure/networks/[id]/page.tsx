import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { OrchestratorNetworkDetail } from '@/features/orchestrator/details/orchestrator-network-detail'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { getPlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'

export default async function OrchestratorNetworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const details = await getPlatformNetworkAction(id)

    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <PlatformPageHeader
          title={details.network.name}
          description='Network details, attached containers, and raw Docker metadata.'
          breadcrumbRoot={{ label: 'Infrastructure' }}
          parent={{ label: 'Networks', href: '/infrastructure/networks' }}
        />
        <OrchestratorNetworkDetail details={details} />
      </ProtectedStackPageLayout>
    )
  } catch (error) {
    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <PlatformPageHeader
          title='Network'
          description='Network details could not be loaded.'
          breadcrumbRoot={{ label: 'Infrastructure' }}
          parent={{ label: 'Networks', href: '/infrastructure/networks' }}
        />
        <section className='px-6 pb-16 pt-6 max-sm:px-4'>
          <StatusSplash
            title='Network not found'
            description='The network may have been removed or Docker may no longer know this id.'
            detail={error instanceof Error ? error.message : 'Unknown error'}
            tone='danger'
            secondaryAction={{ label: 'Back to networks', href: '/infrastructure/networks' }}
            className='min-h-[52vh]'
          />
        </section>
      </ProtectedStackPageLayout>
    )
  }
}
