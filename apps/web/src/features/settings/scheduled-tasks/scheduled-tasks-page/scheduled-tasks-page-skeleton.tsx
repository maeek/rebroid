import { Skeleton } from '@/components/ui/skeleton'
import { DataGridSkeleton } from '@/shared/ui/data-grid'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'

export const ScheduledTasksPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-48'
      includeOrchestratorBreadcrumb={false}
      actionCount={1}
    />
    <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4'>
      <div
        className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'
        data-testid='scheduler-summary-skeleton'
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className='rounded-panel border border-surface-border/60 bg-surface-panel/45 px-4 py-3'
          >
            <Skeleton className='h-3 w-20' />
            <Skeleton className='mt-2 h-8 w-12' />
          </div>
        ))}
      </div>
      <div
        className='grid gap-3'
        data-testid='scheduler-grid-skeleton'
      >
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-control border border-surface-border/60 bg-surface-panel/35 px-3 py-2'>
          <Skeleton className='h-4 w-32' />
          <div className='flex flex-wrap gap-2'>
            <Skeleton className='h-9 w-20' />
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-24' />
          </div>
        </div>
        <DataGridSkeleton
          columns={[
            { width: '24rem', headerWidth: 'w-16', cellWidth: 'w-44', kind: 'stacked' },
            { width: '11rem', headerWidth: 'w-20', cellWidth: 'w-28', kind: 'badge' },
            { width: '11rem', headerWidth: 'w-16', cellWidth: 'w-32' },
            { width: '11rem', headerWidth: 'w-20', cellWidth: 'w-32' },
            { width: '11rem', headerWidth: 'w-20', cellWidth: 'w-32' },
            { width: '7rem', headerWidth: 'w-16', kind: 'action' }
          ]}
          minWidth='82rem'
          rows={5}
        />
      </div>
    </section>
  </StandardPage>
)
