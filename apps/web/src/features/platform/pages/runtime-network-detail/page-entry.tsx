import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { RuntimeNetworkDetail } from '../../details/runtime-network-detail'
import { loadRuntimeNetworkDetailPageData } from './page-data.server'

export async function RuntimeNetworkDetailPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { details } = await loadRuntimeNetworkDetailPageData(id)

    return (
      <StandardPage className='gap-2'>
        <RuntimeNetworkDetail details={details} />
      </StandardPage>
    )
  } catch {
    return (
      <StandardPage className='gap-2'>
        <PageHeader
          section={{ label: 'Runtime' }}
          trail={[{ label: 'Networks', href: '/runtime/networks' }]}
          title='Network'
          description='Network details could not be loaded.'
        />
        <PageContent>
          <StateView
            kind='not-found'
            title='Network not found'
            description='The network may have been removed or Docker may no longer know this id.'
            actions={[{ label: 'Back to networks', href: '/runtime/networks' }]}
          />
        </PageContent>
      </StandardPage>
    )
  }
}
