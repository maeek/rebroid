import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { RuntimeImageDetail } from '../../details/runtime-image-detail'
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
  } catch {
    return (
      <StandardPage className='gap-2'>
        <PageHeader
          section={{ label: 'Runtime' }}
          trail={[{ label: 'Images', href: '/runtime/images' }]}
          title='Image'
          description='Image details could not be loaded.'
        />
        <PageContent>
          <StateView
            kind='not-found'
            title='Image not found'
            description='The image may have been removed or Docker may no longer know this id.'
            actions={[{ label: 'Back to images', href: '/runtime/images' }]}
          />
        </PageContent>
      </StandardPage>
    )
  }
}
