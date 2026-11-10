import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { RuntimeImageDetail } from '../../details/runtime-image-detail'
import { RuntimeDetailUnavailable } from '../runtime-detail-unavailable'
import { loadRuntimeImageDetailPageData } from './page-data.server'

export async function RuntimeImageDetailPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const result = await readOrchestratorPage(() => loadRuntimeImageDetailPageData(id), { allowMissing: true })
  if (result.ok) {
    const { details } = result.data

    return (
      <StandardPage className='gap-2'>
        <RuntimeImageDetail details={details} />
      </StandardPage>
    )
  }

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Runtime' }}
        trail={[{ label: 'Images', href: '/runtime/images' }]}
        title='Image'
        description='Image details could not be loaded.'
      />
      <PageContent>
        <RuntimeDetailUnavailable
          failure={result.failure}
          resource='Image'
          href='/runtime/images'
          backLabel='Back to images'
        />
      </PageContent>
    </StandardPage>
  )
}
