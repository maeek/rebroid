import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { OrchestratorImageDetail } from '@/features/orchestrator/details/orchestrator-image-detail'
import { imageDisplayName } from '@/features/orchestrator/domain/image-display-name'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { requireAdmin } from '@/server/auth/authorization'
import { getPlatformImageAction } from '@/server/orchestrator/platform/actions'

export default async function OrchestratorImageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  try {
    const details = await getPlatformImageAction(id)

    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <PlatformPageHeader
          title={imageDisplayName(details.image)}
          description='Image details, related containers, and raw Docker metadata.'
          parent={{ label: 'Images', href: '/settings/orchestrator/images' }}
        />
        <OrchestratorImageDetail details={details} />
      </ProtectedStackPageLayout>
    )
  } catch (error) {
    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <PlatformPageHeader
          title='Image'
          description='Image details could not be loaded.'
          parent={{ label: 'Images', href: '/settings/orchestrator/images' }}
        />
        <section className='px-6 pb-16 pt-6 max-sm:px-4'>
          <StatusSplash
            title='Image not found'
            description='The image may have been removed or Docker may no longer know this id.'
            detail={error instanceof Error ? error.message : 'Unknown error'}
            tone='danger'
            secondaryAction={{ label: 'Back to images', href: '/settings/orchestrator/images' }}
            className='min-h-[52vh]'
          />
        </section>
      </ProtectedStackPageLayout>
    )
  }
}
