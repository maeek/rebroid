import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton } from '@/features/orchestrator/components/orchestrator-page-skeletons/page-header-skeleton'
import { TableSkeleton } from '@/features/orchestrator/components/orchestrator-page-skeletons/table-skeleton'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'

export const ScheduledTasksPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-48'
      includeOrchestratorBreadcrumb={false}
      actionCount={1}
    />
    <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='overflow-hidden rounded-lg border border-border/70 bg-card/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md'>
        <div className='border-b border-border/60 px-5 py-4 max-sm:px-4'>
          <div className='grid gap-2'>
            <Skeleton className='h-5 w-16' />
            <Skeleton className='h-4 w-56 max-w-full opacity-70' />
          </div>
        </div>
        <TableSkeleton
          columns={[
            { headerWidth: 'w-16', cellWidth: 'w-44', kind: 'stacked' },
            { headerWidth: 'w-20', cellWidth: 'w-28' },
            { headerWidth: 'w-16', kind: 'badge' },
            { headerWidth: 'w-20', cellWidth: 'w-32' },
            { headerWidth: 'w-16', kind: 'action' }
          ]}
          rows={5}
        />
      </div>
    </section>
  </ProtectedStackPageLayout>
)
