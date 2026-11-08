import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { RuntimeContainerDetail } from '../../details/runtime-container-detail/runtime-container-detail'
import { loadRuntimeContainerDetailPageData } from './page-data.server'

export async function RuntimeContainerDetailPageEntry({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const [{ id }, search] = await Promise.all([params, searchParams])
  const view = search.view === 'logs' ? 'logs' : 'overview'

  try {
    const { details, logs } = await loadRuntimeContainerDetailPageData(id, view)

    return (
      <StandardPage className='gap-2'>
        <RuntimeContainerDetail
          view={view}
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
