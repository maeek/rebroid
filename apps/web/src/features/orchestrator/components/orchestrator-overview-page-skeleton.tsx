import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton } from '@/features/orchestrator/components/orchestrator-page-skeletons/page-header-skeleton'
import { TableSkeleton } from '@/features/orchestrator/components/orchestrator-page-skeletons/table-skeleton'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'

const QuickGlanceSkeleton = () => (
  <div className='grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        key={index}
        className='grid gap-3 rounded-lg border border-border/70 bg-card/40 p-4'
      >
        <Skeleton className='h-3 w-36' />
        <Skeleton className='h-8 w-24' />
        <Skeleton className='h-3 w-full max-w-64 opacity-70' />
      </div>
    ))}
  </div>
)

const ChartSkeleton = ({ titleWidth }: { titleWidth: string }) => (
  <div className='rounded-lg border border-border/70 bg-card/40 p-6 max-sm:p-4'>
    <Skeleton className={`mb-6 h-5 ${titleWidth}`} />
    <div className='flex h-72 items-end gap-2'>
      {Array.from({ length: 18 }).map((_, index) => (
        <Skeleton
          key={index}
          className='w-full'
          style={{ height: `${28 + ((index * 17) % 58)}%` }}
        />
      ))}
    </div>
  </div>
)

export const OrchestratorOverviewPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-36'
      actionCount={1}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-4 max-sm:px-4'>
      <div className='grid gap-4'>
        <Skeleton className='h-5 w-24' />
        <QuickGlanceSkeleton />
        <Skeleton className='h-3 w-72 max-w-full opacity-70' />
      </div>
    </section>
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <Skeleton className='h-6 w-24' />
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className='grid gap-3 rounded-lg border border-border/70 bg-card/40 p-4'
          >
            <Skeleton className='h-3 w-24' />
            <Skeleton className='h-8 w-14' />
            <Skeleton className='h-3 w-full opacity-70' />
          </div>
        ))}
      </div>
      <div className='rounded-lg border border-border/70 bg-card/40 p-6 max-sm:p-4'>
        <Skeleton className='mb-5 h-5 w-40' />
        <div className='grid gap-2'>
          <Skeleton className='h-4 w-48' />
          <Skeleton className='h-4 w-80 max-w-full' />
          <Skeleton className='h-4 w-96 max-w-full' />
        </div>
      </div>
      <div className='grid gap-6 xl:grid-cols-2'>
        <ChartSkeleton titleWidth='w-56' />
        <ChartSkeleton titleWidth='w-64' />
      </div>
      <TableSkeleton
        columns={[
          { headerWidth: 'w-16', cellWidth: 'w-16' },
          { headerWidth: 'w-24', cellWidth: 'w-40' },
          { headerWidth: 'w-16', cellWidth: 'w-14' },
          { headerWidth: 'w-16', cellWidth: 'w-14' },
          { headerWidth: 'w-16', cellWidth: 'w-14' },
          { headerWidth: 'w-16', cellWidth: 'w-14' }
        ]}
        rows={6}
      />
    </section>
  </ProtectedStackPageLayout>
)
