import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { StatusSplash } from '@/app/(protected)/_components/status-splash'
import { requireAdmin } from '@/server/auth/authorization'
import { getPlatformContainerAction, getPlatformContainerLogsAction } from '@/server/orchestrator/platform/actions'
import { PlatformPageHeader } from '../../_components/platform-page-header'
import { OrchestratorContainerDetail } from './orchestrator-container-detail'

export default async function OrchestratorContainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  try {
    const [details, logs] = await Promise.all([getPlatformContainerAction(id), getPlatformContainerLogsAction(id)])
    const name = details.container.names[0] ?? details.container.shortId

    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <PlatformPageHeader
          title={name}
          description='Container details, related Docker resources, and recent logs.'
          parent={{ label: 'Containers', href: '/settings/orchestrator/containers' }}
        />
        <OrchestratorContainerDetail
          details={details}
          initialLogs={logs}
        />
      </ProtectedStackPageLayout>
    )
  } catch (error) {
    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <PlatformPageHeader
          title='Container'
          description='Container details could not be loaded.'
          parent={{ label: 'Containers', href: '/settings/orchestrator/containers' }}
        />
        <section className='px-6 pb-16 pt-6 max-sm:px-4'>
          <StatusSplash
            title='Container not found'
            description='The container may have been removed or Docker may no longer know this id.'
            detail={error instanceof Error ? error.message : 'Unknown error'}
            tone='danger'
            secondaryAction={{
              label: 'Back to containers',
              href: '/settings/orchestrator/containers'
            }}
            className='min-h-[52vh]'
          />
        </section>
      </ProtectedStackPageLayout>
    )
  }
}
