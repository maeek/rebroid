import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { StatusSplash } from '@/shared/ui/status-splash'
import { RuntimeNetworkDetail } from '../../details/runtime-network-detail'
import { loadRuntimeNetworkDetailPageData } from './page-data.server'

export async function RuntimeNetworkDetailPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { details } = await loadRuntimeNetworkDetailPageData(id)

    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <PlatformPageHeader
          title={details.network.name}
          description='Network details, attached containers, and raw Docker metadata.'
          breadcrumbRoot={{ label: 'Runtime' }}
          parent={{ label: 'Networks', href: '/runtime/networks' }}
        />
        <RuntimeNetworkDetail details={details} />
      </ProtectedStackPageLayout>
    )
  } catch (error) {
    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <PlatformPageHeader
          title='Network'
          description='Network details could not be loaded.'
          breadcrumbRoot={{ label: 'Runtime' }}
          parent={{ label: 'Networks', href: '/runtime/networks' }}
        />
        <section className='px-6 pb-16 pt-6 max-sm:px-4'>
          <StatusSplash
            title='Network not found'
            description='The network may have been removed or Docker may no longer know this id.'
            detail={error instanceof Error ? error.message : 'Unknown error'}
            tone='danger'
            secondaryAction={{ label: 'Back to networks', href: '/runtime/networks' }}
            className='min-h-[52vh]'
          />
        </section>
      </ProtectedStackPageLayout>
    )
  }
}
