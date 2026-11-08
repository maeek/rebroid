import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { RuntimeContainerDetail } from '../../details/runtime-container-detail/runtime-container-detail'
import { RuntimeDetailUnavailable } from '../runtime-detail-unavailable'
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
  } catch (error) {
    return (
      <StandardPage className='gap-2'>
        <PageHeader
          section={{ label: 'Runtime' }}
          trail={[{ label: 'Containers', href: '/runtime/containers' }]}
          title='Container'
          description='Container details could not be loaded.'
        />
        <PageContent>
          <RuntimeDetailUnavailable
            error={error}
            resource='Container'
            href='/runtime/containers'
            backLabel='Back to containers'
          />
        </PageContent>
      </StandardPage>
    )
  }
}
