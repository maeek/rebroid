import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton } from '@/features/orchestrator/components/orchestrator-page-skeletons/page-header-skeleton'
import { TableSkeleton } from '@/features/orchestrator/components/orchestrator-page-skeletons/table-skeleton'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'

const ProviderConnectionSkeleton = () => (
  <div className='rounded-lg border border-border/70 bg-card/40 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] max-sm:p-4'>
    <div className='mb-5 grid gap-2'>
      <Skeleton className='h-4 w-24' />
      <Skeleton className='h-3 w-full max-w-lg opacity-70' />
    </div>
    <div className='grid gap-4'>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className='grid gap-2'
        >
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-3 w-full max-w-xl opacity-70' />
          <Skeleton className='h-10 w-full' />
        </div>
      ))}
    </div>
  </div>
)

export const AiProvidersPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-44'
      actionCount={2}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <TableSkeleton
        columns={[
          { headerWidth: 'w-20', cellWidth: 'w-44', kind: 'stacked' },
          { headerWidth: 'w-12', cellWidth: 'w-20' },
          { headerWidth: 'w-20', cellWidth: 'w-64' },
          { headerWidth: 'w-16', cellWidth: 'w-52' },
          { headerWidth: 'w-14', kind: 'badge' },
          { headerWidth: 'w-14', kind: 'badge' }
        ]}
        rows={5}
      />
    </section>
  </ProtectedStackPageLayout>
)

export const AiProviderEditPageSkeleton = () => (
  <ProtectedStackPageLayout mainClassName='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-48'
      hasParent
      actionCount={2}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <div className='rounded-lg border border-border/70 bg-card/40 p-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='grid gap-2'>
            <Skeleton className='h-4 w-28' />
            <Skeleton className='h-3 w-80 max-w-full opacity-70' />
          </div>
          <Skeleton className='h-6 w-16 rounded-full' />
        </div>
      </div>
      <ProviderConnectionSkeleton />
      <div className='grid gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='grid gap-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-3 w-96 max-w-full opacity-70' />
          </div>
          <Skeleton className='h-9 w-28' />
        </div>
        <TableSkeleton
          columns={[
            { headerWidth: 'w-20', cellWidth: 'w-44' },
            { headerWidth: 'w-12', cellWidth: 'w-44' },
            { headerWidth: 'w-12', cellWidth: 'w-32' },
            { headerWidth: 'w-12', cellWidth: 'w-28' },
            { headerWidth: 'w-14', kind: 'badge' }
          ]}
          rows={4}
        />
      </div>
    </section>
  </ProtectedStackPageLayout>
)
