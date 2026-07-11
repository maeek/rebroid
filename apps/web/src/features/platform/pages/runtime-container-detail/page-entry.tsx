import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { StatusSplash } from '@/shared/ui/status-splash'
import { RuntimeContainerDetail } from '../../details/runtime-container-detail/runtime-container-detail'
import { loadRuntimeContainerDetailPageData } from './page-data.server'

export async function RuntimeContainerDetailPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { details, logs, name } = await loadRuntimeContainerDetailPageData(id)

    return (
      <StandardPage className='gap-2'>
        <PlatformPageHeader
          title={name}
          description='Container details, related Docker resources, and recent logs.'
          breadcrumbRoot={{ label: 'Runtime' }}
          parent={{ label: 'Containers', href: '/runtime/containers' }}
        />
        <RuntimeContainerDetail
          details={details}
          initialLogs={logs}
        />
      </StandardPage>
    )
  } catch (error) {
    return (
      <StandardPage className='gap-2'>
        <PlatformPageHeader
          title='Container'
          description='Container details could not be loaded.'
          breadcrumbRoot={{ label: 'Runtime' }}
          parent={{ label: 'Containers', href: '/runtime/containers' }}
        />
        <section className='px-6 pb-16 pt-6 max-sm:px-4'>
          <StatusSplash
            title='Container not found'
            description='The container may have been removed or Docker may no longer know this id.'
            detail={error instanceof Error ? error.message : 'Unknown error'}
            tone='danger'
            secondaryAction={{
              label: 'Back to containers',
              href: '/runtime/containers'
            }}
            className='min-h-[52vh]'
          />
        </section>
      </StandardPage>
    )
  }
}
