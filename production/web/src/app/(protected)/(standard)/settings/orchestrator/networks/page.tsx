import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { requireAdmin } from '@/server/auth/authorization'
import { OrchestratorNetworksSection } from '../_components/orchestrator-networks-section'
import { PlatformPageHeader } from '../_components/platform-page-header'

export default async function OrchestratorNetworksPage() {
  await requireAdmin()

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Networks'
        description='Docker networks visible to the platform, including application isolation networks.'
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <OrchestratorNetworksSection />
      </section>
    </ProtectedStackPageLayout>
  )
}
