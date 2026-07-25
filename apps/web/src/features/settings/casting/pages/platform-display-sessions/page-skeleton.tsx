import { OperationalSettingsSkeleton } from '@/features/settings/orchestrator/operational-settings-skeleton'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'

const castingColumns = [
  { width: '12rem', headerWidth: 'w-20', kind: 'text' },
  { width: '12rem', headerWidth: 'w-14', kind: 'text' },
  { width: '8rem', headerWidth: 'w-14', kind: 'badge' },
  { width: '14rem', headerWidth: 'w-24', kind: 'text' },
  { width: '14rem', headerWidth: 'w-14', kind: 'text' },
  { width: '9rem', headerWidth: 'w-14', kind: 'actions' }
] as const

export const PlatformDisplaySessionsPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-36 max-sm:w-24'
      includeOrchestratorBreadcrumb={false}
      hasParent
      actionCount={1}
    />
    <PageContent>
      <OperationalSettingsSkeleton
        title='Sessions'
        columns={[...castingColumns]}
        minWidth='52rem'
      />
    </PageContent>
  </StandardPage>
)
