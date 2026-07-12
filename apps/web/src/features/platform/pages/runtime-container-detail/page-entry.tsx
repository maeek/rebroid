import { Badge } from '@/components/ui/badge'
import { ContainerStateBadge } from '@/features/platform/components/runtime-containers-table-parts'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { RuntimeContainerDetail } from '../../details/runtime-container-detail/runtime-container-detail'
import { loadRuntimeContainerDetailPageData } from './page-data.server'

export async function RuntimeContainerDetailPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { details, logs, name } = await loadRuntimeContainerDetailPageData(id)

    return (
      <StandardPage className='gap-2'>
        <PageHeader
          section={{ label: 'Runtime' }}
          trail={[{ label: 'Containers', href: '/runtime/containers' }]}
          title={name}
          description='Container details, related Docker resources, and recent logs.'
          badges={
            <>
              {details.container.managed ? <Badge variant='success'>managed</Badge> : null}
              <ContainerStateBadge state={details.container.state} />
            </>
          }
          meta={<span className='font-mono'>{details.container.shortId}</span>}
        />
        <RuntimeContainerDetail
          details={details}
          initialLogs={logs}
        />
      </StandardPage>
    )
  } catch {
    return (
      <StandardPage className='gap-2'>
        <PageHeader
          section={{ label: 'Runtime' }}
          trail={[{ label: 'Containers', href: '/runtime/containers' }]}
          title='Container'
          description='Container details could not be loaded.'
        />
        <PageContent>
          <StateView
            kind='not-found'
            title='Container not found'
            description='The container may have been removed or Docker may no longer know this id.'
            actions={[
              {
                label: 'Back to containers',
                href: '/runtime/containers'
              }
            ]}
          />
        </PageContent>
      </StandardPage>
    )
  }
}
