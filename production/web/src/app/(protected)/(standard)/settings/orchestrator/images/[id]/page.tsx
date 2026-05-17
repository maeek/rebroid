import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { StatusSplash } from '@/app/(protected)/_components/status-splash'
import { imageDisplayName } from '@/lib/orchestrator/image-display-name'
import { requireAdmin } from '@/server/auth/authorization'
import { getPlatformImageAction } from '@/server/orchestrator/platform/actions'
import { PlatformPageHeader } from '../../_components/platform-page-header'
import { OrchestratorImageDetail } from './orchestrator-image-detail'

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
