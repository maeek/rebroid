import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { RuntimeImageDetail } from '../../details/runtime-image-detail'
import { RuntimeDetailUnavailable } from '../runtime-detail-unavailable'
import { loadRuntimeImageDetailPageData } from './page-data.server'

export async function RuntimeImageDetailPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { details } = await loadRuntimeImageDetailPageData(id)

    return (
      <StandardPage className='gap-2'>
        <RuntimeImageDetail details={details} />
      </StandardPage>
    )
  } catch (error) {
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
            error={error}
            resource='Image'
            href='/runtime/images'
            backLabel='Back to images'
          />
        </PageContent>
      </StandardPage>
    )
  }
}
