import { RuntimeImageBadges } from '@/features/platform/components/runtime-image-badges'
import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
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
        <PageHeader
          section={{ label: 'Runtime' }}
          trail={[{ label: 'Images', href: '/runtime/images' }]}
          title={imageDisplayName(details.image)}
          description='Image details, related containers, and raw Docker metadata.'
          badges={<RuntimeImageBadges image={details.image} />}
          meta={<span className='font-mono'>{details.image.shortId}</span>}
        />
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
