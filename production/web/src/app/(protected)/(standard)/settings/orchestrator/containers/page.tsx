import { OrchestratorContainersSection } from '@/features/orchestrator/components/orchestrator-containers-section'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'

export default function OrchestratorContainersPage() {
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
