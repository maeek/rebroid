import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { RuntimeNetworkDetail } from '../../details/runtime-network-detail'
import { RuntimeDetailUnavailable } from '../runtime-detail-unavailable'
import { loadRuntimeNetworkDetailPageData } from './page-data.server'

export async function RuntimeNetworkDetailPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const result = await readOrchestratorPage(() => loadRuntimeNetworkDetailPageData(id), { allowMissing: true })
  if (result.ok) {
    const { details } = result.data

    return (
      <StandardPage className='gap-2'>
        <RuntimeNetworkDetail details={details} />
      </StandardPage>
    )
  }

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Docker' }}
        trail={[{ label: 'Networks', href: '/runtime/networks' }]}
        title='Network'
        description='Network details could not be loaded.'
      />
      <PageContent>
        <RuntimeDetailUnavailable
          failure={result.failure}
          resource='Network'
          href='/runtime/networks'
          backLabel='Back to networks'
        />
      </PageContent>
    </StandardPage>
  )
}
