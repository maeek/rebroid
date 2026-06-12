import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { StatusSplash } from '@/shared/ui/status-splash'
import { OrchestratorContainerDetail } from '../../details/orchestrator-container-detail/orchestrator-container-detail'
import { loadInfrastructureContainerDetailPageData } from './page-data.server'

export async function InfrastructureContainerDetailPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { details, logs, name } = await loadInfrastructureContainerDetailPageData(id)

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
