import { Skeleton } from '@/components/ui/skeleton'
import { DataGridSkeleton } from '@/shared/ui/data-grid/data-grid-skeleton'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'

export const PlatformServicesPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-36'
      includeOrchestratorBreadcrumb={false}
      actionCount={2}
    />
    <section className='px-6 pb-16 max-sm:px-4'>
      <div className='grid gap-4'>
        <Skeleton className='h-4 w-full max-w-3xl opacity-70' />
        <DataGridSkeleton
          minWidth='78rem'
          rows={2}
          selectable={false}
          columns={[
            { width: '20rem', headerWidth: 'w-20', kind: 'stacked' },
            { width: '8rem', headerWidth: 'w-12', kind: 'badge' },
            { width: '22rem', headerWidth: 'w-20', cellWidth: 'w-[80%]' },
            { width: '8rem', headerWidth: 'w-16', cellWidth: 'w-20' },
            { width: '20rem', headerWidth: 'w-16', cellWidth: 'w-[74%]' },
            { width: '7rem', headerWidth: 'w-16', kind: 'action' }
          ]}
        />
      </div>
    </section>
  </StandardPage>
)
