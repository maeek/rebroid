import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { PlatformOperationsContent } from './platform-operations-content'

export const PlatformOperationsPreview = () => (
  <StandardPage className='gap-2'>
    <PageHeader
      title='Overview'
      description='App failures, active operations, and platform capacity.'
    />
    <PageContent>
      <PlatformOperationsContent
        snapshot={{
          failedCount: 128,
          pendingCount: 2,
          activeRunCount: 1,
          failed: Array.from({ length: 8 }, (_, index) => ({
            id: `app-${index}`,
            name: `Inventory worker ${index + 1}`,
            description:
              'Outbound policy enforcement failed: Container network address is not available yet. Open diagnostics to inspect the runtime and retry.'
          })),
          pending: [
            { id: 'pending-app', name: 'Device provisioning', title: 'Waiting for Android to finish starting.' }
          ],
          runs: [{ id: 'run-12345678', automationId: 'workflow-1', status: 'running' }]
        }}
      />
    </PageContent>
  </StandardPage>
)
