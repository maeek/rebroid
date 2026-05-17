import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { requireAdmin } from '@/server/auth/authorization'
import { OrchestratorContainersSection } from '../_components/orchestrator-containers-section'
import { PlatformPageHeader } from '../_components/platform-page-header'

export default async function OrchestratorContainersPage() {
  await requireAdmin()

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Containers'
        description='Docker containers visible to the platform. Managed application containers are shown first.'
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <OrchestratorContainersSection />
      </section>
    </ProtectedStackPageLayout>
  )
}
