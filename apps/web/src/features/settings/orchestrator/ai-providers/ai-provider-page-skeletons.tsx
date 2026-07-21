import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { DataGridSkeleton } from '@/shared/ui/data-grid/data-grid-skeleton'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { PageHeaderSkeleton } from '@/shared/ui/skeletons/page-header-skeleton'

const ProviderConnectionSkeleton = () => (
  <Section
    surface='panel'
    contentClassName='gap-5'
  >
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
  </Section>
)

export const AiProvidersPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-44'
      hasLeading
      titleActionCount={1}
      actionCount={1}
    />
    <section className='flex w-full flex-col gap-4 px-6 pb-16 max-sm:px-4'>
      <div
        className='flex w-full items-start justify-between gap-4 rounded-control border border-surface-border/60 bg-surface-panel/35 px-4 py-3'
        data-testid='ai-context-suggestions-skeleton'
      >
        <div className='grid min-w-0 flex-1 gap-2'>
          <Skeleton className='h-4 w-36' />
          <Skeleton className='h-3 w-72 max-w-full opacity-70' />
        </div>
        <Skeleton className='h-6 w-12 shrink-0 rounded-full' />
      </div>
      <div
        className='grid gap-2'
        data-testid='ai-providers-heading-skeleton'
      >
        <Skeleton className='h-5 w-20' />
        <Skeleton className='h-4 w-full max-w-2xl opacity-70' />
      </div>
      <DataGridSkeleton
        columns={[
          { width: '20rem', headerWidth: 'w-20', cellWidth: 'w-44', kind: 'stacked' },
          { width: '10rem', headerWidth: 'w-12', cellWidth: 'w-20' },
          { width: '24rem', headerWidth: 'w-20', cellWidth: 'w-64' },
          { width: '20rem', headerWidth: 'w-16', cellWidth: 'w-52' },
          { width: '10rem', headerWidth: 'w-14', kind: 'badge' },
          { width: '10rem', headerWidth: 'w-14', kind: 'badge' }
        ]}
        minWidth='76rem'
        rows={5}
      />
    </section>
  </StandardPage>
)

export const AiProviderEditPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeaderSkeleton
      titleWidth='w-48'
      hasLeading
      hasParent
      actionCount={2}
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
      <Section
        surface='panel'
        contentClassName='gap-0'
      >
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='grid gap-2'>
            <Skeleton className='h-4 w-28' />
            <Skeleton className='h-3 w-80 max-w-full opacity-70' />
          </div>
          <Skeleton className='h-6 w-16 rounded-full' />
        </div>
      </Section>
      <ProviderConnectionSkeleton />
      <div className='grid gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='grid gap-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-3 w-96 max-w-full opacity-70' />
          </div>
          <Skeleton className='h-9 w-28' />
        </div>
        <DataGridSkeleton
          columns={[
            { width: '18rem', headerWidth: 'w-20', cellWidth: 'w-44' },
            { width: '18rem', headerWidth: 'w-12', cellWidth: 'w-44' },
            { width: '12rem', headerWidth: 'w-12', cellWidth: 'w-32' },
            { width: '12rem', headerWidth: 'w-12', cellWidth: 'w-28' },
            { width: '10rem', headerWidth: 'w-14', kind: 'badge' }
          ]}
          minWidth='70rem'
          rows={4}
        />
      </div>
    </section>
  </StandardPage>
)
