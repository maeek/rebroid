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
          activeRunCount: 1
        }}
      />
    </PageContent>
  </StandardPage>
)
