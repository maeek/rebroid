import { OrchestratorImagesSection } from '@/features/orchestrator/components/orchestrator-images-section'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { requireAdmin } from '@/server/auth/authorization'

export default async function OrchestratorImagesPage() {
  await requireAdmin()

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Images'
        description='Local images available to application containers, custom runtimes, and platform sidecars.'
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <OrchestratorImagesSection />
      </section>
    </ProtectedStackPageLayout>
  )
}
