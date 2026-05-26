import { OrchestratorNetworksSection } from '@/features/orchestrator/components/orchestrator-networks-section'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'

export default function OrchestratorNetworksPage() {
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
