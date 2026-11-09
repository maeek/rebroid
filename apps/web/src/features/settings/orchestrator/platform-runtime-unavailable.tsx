import { PageLoadFailure } from '@/shared/ui/page/page-load-failure'
import { PlatformRuntimePageLayout } from './platform-runtime-page-layout'

export const PlatformRuntimeUnavailable = () => (
  <PlatformRuntimePageLayout showActions={false}>
    <PageLoadFailure
      title='Runtime defaults unavailable'
      description='Runtime settings could not be loaded. Check that the orchestrator and Docker are available, then try again.'
      backAction={{ label: 'Go to overview', href: '/platform' }}
    />
  </PlatformRuntimePageLayout>
)
