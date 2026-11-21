import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/server/auth/authorization'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { readContainerResourceView } from '@/shared/model/container-resource-href'
import { dockerOpenTerminal, hasDockerTerminalPrivilege } from '@/shared/permissions/docker-terminal'
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
  const view = readContainerResourceView(search.view)
  if (view === 'terminal' && !hasDockerTerminalPrivilege(await getCurrentUser(), dockerOpenTerminal)) notFound()

  const result = await readOrchestratorPage(() => loadRuntimeContainerDetailPageData(id, view), { allowMissing: true })
  if (result.ok) {
    const { details, pendingLogs } = result.data

    return (
      <RuntimeContainerDetail
        view={view}
        details={details}
        pendingLogs={pendingLogs}
      />
    )
  }

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Docker' }}
        trail={[{ label: 'Containers', href: '/runtime/containers' }]}
        title='Container'
        description='Container details could not be loaded.'
      />
      <PageContent>
        <RuntimeDetailUnavailable
          failure={result.failure}
          resource='Container'
          href='/runtime/containers'
          backLabel='Back to containers'
        />
      </PageContent>
    </StandardPage>
  )
}
