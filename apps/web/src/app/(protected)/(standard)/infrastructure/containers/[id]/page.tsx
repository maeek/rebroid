import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { OrchestratorContainerDetail } from '@/features/orchestrator/details/orchestrator-container-detail/orchestrator-container-detail'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { StatusSplash } from '@/features/shell/components/status-splash'
import {
  getPlatformContainerAction,
  getPlatformContainerLogsAction
} from '@/server/orchestrator/platform/container-actions'

export default async function OrchestratorContainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const [details, logs] = await Promise.all([getPlatformContainerAction(id), getPlatformContainerLogsAction(id)])
    const name = details.container.names[0] ?? details.container.shortId

    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <PlatformPageHeader
          title={name}
          description='Container details, related Docker resources, and recent logs.'
          breadcrumbRoot={{ label: 'Infrastructure' }}
          parent={{ label: 'Containers', href: '/infrastructure/containers' }}
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
          breadcrumbRoot={{ label: 'Infrastructure' }}
          parent={{ label: 'Containers', href: '/infrastructure/containers' }}
        />
        <section className='px-6 pb-16 pt-6 max-sm:px-4'>
          <StatusSplash
            title='Container not found'
            description='The container may have been removed or Docker may no longer know this id.'
            detail={error instanceof Error ? error.message : 'Unknown error'}
            tone='danger'
            secondaryAction={{
              label: 'Back to containers',
              href: '/infrastructure/containers'
            }}
            className='min-h-[52vh]'
          />
        </section>
      </ProtectedStackPageLayout>
    )
  }
}
