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
          collectedAt: '2026-11-07T10:00:00Z',
          failedCount: 128,
          pendingCount: 2,
          activeRunCount: 1,
          activeRuns: [
            {
              id: 'inventory-run',
              name: 'Daily inventory check',
              impact: 'Running',
              href: '/automations/inventory/traces?run=inventory-run'
            }
          ],
          workflowCatalogAvailable: true
        }}
      />
    </PageContent>
  </StandardPage>
)
