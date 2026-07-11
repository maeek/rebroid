import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { StatusSplash } from '@/shared/ui/status-splash'
import { RuntimeImageDetail } from '../../details/runtime-image-detail'
import { loadRuntimeImageDetailPageData } from './page-data.server'

export async function RuntimeImageDetailPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { details } = await loadRuntimeImageDetailPageData(id)

    return (
      <StandardPage className='gap-2'>
        <PlatformPageHeader
          title={imageDisplayName(details.image)}
          description='Image details, related containers, and raw Docker metadata.'
          breadcrumbRoot={{ label: 'Runtime' }}
          parent={{ label: 'Images', href: '/runtime/images' }}
        />
        <RuntimeImageDetail details={details} />
      </StandardPage>
    )
  } catch (error) {
    return (
      <StandardPage className='gap-2'>
        <PlatformPageHeader
          title='Image'
          description='Image details could not be loaded.'
          breadcrumbRoot={{ label: 'Runtime' }}
          parent={{ label: 'Images', href: '/runtime/images' }}
        />
        <section className='px-6 pb-16 pt-6 max-sm:px-4'>
          <StatusSplash
            title='Image not found'
            description='The image may have been removed or Docker may no longer know this id.'
            detail={error instanceof Error ? error.message : 'Unknown error'}
            tone='danger'
            secondaryAction={{ label: 'Back to images', href: '/runtime/images' }}
            className='min-h-[52vh]'
          />
        </section>
      </StandardPage>
    )
  }
}
