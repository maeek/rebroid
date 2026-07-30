import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { bandSurfaceClassName, panelSurfaceClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { AppIconSkeleton } from '@/shared/ui/app-icon/app-icon-skeleton'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { PageContent, StandardPageSplit } from '@/shared/ui/page/page-layout'

const AppHeadingSkeleton = ({ showStatus = true, actionCount = 2 }: { showStatus?: boolean; actionCount?: number }) => (
  <div className='flex w-full flex-wrap items-center justify-between gap-4 py-4 max-sm:pb-0'>
    <div className='flex min-w-0 items-center gap-4 overflow-hidden'>
      <AppIconSkeleton className='size-10 shrink-0' />
      <Skeleton className='h-8 w-48 max-w-[calc(100vw-12rem)] max-sm:h-7 max-sm:w-32' />
      {showStatus ? <Skeleton className='h-5 w-20 shrink-0 rounded-full' /> : null}
    </div>
    <div className='flex shrink-0 gap-2'>
      {Array.from({ length: actionCount }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-10', index === 0 ? 'w-10' : 'w-24')}
        />
      ))}
    </div>
  </div>
)

const RuntimeToolsSkeleton = ({ compact = false }: { compact?: boolean }) => (
  <div className={cn('flex min-h-0 w-full flex-1 flex-col gap-4', compact && 'px-4')}>
    <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
      <div className='flex w-full min-w-0 items-center gap-1 overflow-x-auto rounded-control border border-surface-border/70 bg-surface-band/40 px-1.5 py-1'>
        {['w-32', 'w-28', 'w-36'].map((width, index) => (
          <Skeleton
            key={index}
            className={cn('h-10 shrink-0 rounded-control', width)}
          />
        ))}
      </div>
      <div className='min-h-0 overflow-auto py-4'>
        <div className='flex flex-col gap-4'>
          {Array.from({ length: 6 }).map((_, index) => (
            <label
              key={index}
              className='flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center lg:py-1'
            >
              <Skeleton className='h-3 w-28 lg:flex-1/4' />
              <div className='grid w-full min-w-0 gap-1.5 lg:max-w-100'>
                <Skeleton className='h-9 w-full' />
                {index > 2 ? <Skeleton className='h-3 w-full' /> : null}
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  </div>
)

const ViewerPaneSkeleton = ({ workspace = true }: { workspace?: boolean }) => (
  <div
    className={cn(
      'flex w-full items-start justify-center rounded-panel px-2 py-2 max-sm:px-1 max-sm:py-2 sm:p-4 lg:sticky lg:top-10 lg:self-stretch lg:items-stretch lg:pr-4 lg:pt-6',
      workspace ? 'max-w-[min(100%,42rem)] lg:min-h-[calc(100dvh-4rem)] lg:flex-1' : 'max-w-[min(100%,42rem)]'
    )}
  >
    <div className='relative flex w-full items-center justify-center'>
      <div className='relative flex h-[min(70dvh,58rem)] min-h-104 w-full flex-col overflow-hidden rounded-feature bg-transparent p-3 sm:h-[min(78dvh,58rem)] sm:min-h-136'>
        <div className='flex shrink-0 items-center gap-2'>
          <Skeleton className='h-9 w-28 rounded-control' />
          <Skeleton className='h-9 w-9 rounded-full' />
        </div>
        <div className='flex min-h-0 flex-1 items-center justify-center px-2 py-3 sm:px-6'>
          <div className='flex h-full max-h-184 w-auto max-w-full aspect-9/16 flex-col'>
            <Skeleton className='h-8 w-full rounded-t-lg' />
            <Skeleton className='min-h-0 flex-1 rounded-b-lg border border-surface-border/70' />
          </div>
        </div>
        <div className='flex shrink-0 items-center justify-center gap-2 pb-1'>
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton
              key={index}
              className='size-8 rounded-full'
            />
          ))}
        </div>
      </div>
    </div>
  </div>
)

const StatusSectionSkeleton = () => (
  <div className='flex w-full flex-row rounded-panel border border-primary/20 bg-primary/10 px-4 py-3'>
    <Skeleton className='mr-4 size-6 shrink-0 rounded-full' />
    <div className='flex w-full grow flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <Skeleton className='h-5 w-36' />
        <Skeleton className='h-5 w-20 rounded-full' />
      </div>
      <Skeleton className='h-3 w-full max-w-xl opacity-70' />
    </div>
  </div>
)

const BandSectionSkeleton = ({
  titleWidth = 'w-32',
  children,
  className
}: {
  titleWidth?: string
  children: ReactNode
  className?: string
}) => (
  <section className={cn('flex w-full flex-col rounded-panel p-6 max-sm:p-4', bandSurfaceClassName, className)}>
    <Skeleton className={cn('mb-5 h-5', titleWidth)} />
    <div className='flex flex-col gap-5'>{children}</div>
  </section>
)

const SettingSkeleton = ({ withDescription = true, tall = false }: { withDescription?: boolean; tall?: boolean }) => (
  <div className='flex w-full flex-col gap-3'>
    <Skeleton className='h-4 w-36' />
    {withDescription ? <Skeleton className='h-3 w-full max-w-2xl opacity-70' /> : null}
    <Skeleton className={cn('w-full', tall ? 'h-24' : 'h-10')} />
  </div>
)

export const AppPageSkeleton = () => (
  <StandardPageSplit className='h-auto min-h-[calc(100vh-4rem)] items-start'>
    <PageContent className='min-w-0 gap-5 pr-6 lg:min-h-[calc(100dvh-4rem)] lg:flex-1 lg:self-stretch lg:items-stretch'>
      <div className='flex w-full grow flex-col gap-5 lg:min-h-0 lg:flex-1'>
        <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: 'Application' }]} />
        <AppHeadingSkeleton showStatus />
        <div className='hidden min-h-[24rem] grow flex-col lg:flex lg:min-h-0 lg:flex-1'>
          <RuntimeToolsSkeleton />
        </div>
      </div>
    </PageContent>
    <ViewerPaneSkeleton />
    <div className='w-full px-1 lg:hidden'>
      <RuntimeToolsSkeleton compact />
    </div>
  </StandardPageSplit>
)

export const AppManagePageSkeleton = () => (
  <StandardPageSplit>
    <PageContent>
      <PageBreadcrumbs
        items={[{ label: 'Apps', href: '/apps' }, { label: 'Application', href: '#' }, { label: 'Manage' }]}
      />
      <AppHeadingSkeleton
        showStatus={false}
        actionCount={2}
      />
      <div className='flex w-full min-w-0 flex-col gap-10 pb-24'>
        <StatusSectionSkeleton />
        <BandSectionSkeleton
          titleWidth='w-28'
          className='gap-0'
        >
          <div className='grid gap-5 xl:grid-cols-[max-content_1fr]'>
            <div className='flex flex-col items-center gap-4 xl:w-76 xl:pr-5'>
              <AppIconSkeleton className='size-44' />
              <Skeleton className='h-10 w-full' />
            </div>
            <div className='flex flex-col gap-6'>
              <SettingSkeleton />
              <SettingSkeleton />
            </div>
          </div>
        </BandSectionSkeleton>
        <BandSectionSkeleton titleWidth='w-24'>
          <SettingSkeleton />
          <div className='grid gap-5'>
            <SettingSkeleton />
            <SettingSkeleton />
          </div>
          <div className='border-t border-surface-border/60 pt-4'>
            <Skeleton className='h-10 w-full' />
          </div>
        </BandSectionSkeleton>
        <BandSectionSkeleton titleWidth='w-32'>
          <div className='flex flex-wrap gap-2'>
            <Skeleton className='h-5 w-24 rounded-full' />
            <Skeleton className='h-5 w-28 rounded-full' />
          </div>
          <SettingSkeleton />
          <div className='flex w-full flex-col gap-3'>
            <div className='grid gap-1'>
              <Skeleton className='h-4 w-20' />
              <Skeleton className='h-3 w-full max-w-2xl opacity-70' />
            </div>
            <Skeleton className='h-11 w-full' />
          </div>
          <div className='flex gap-2'>
            <Skeleton className='h-10 w-24' />
            <Skeleton className='h-10 w-24' />
          </div>
        </BandSectionSkeleton>
        <section className={cn('flex w-full flex-col rounded-panel p-6 max-sm:p-4', panelSurfaceClassName)}>
          <Skeleton className='mb-5 h-5 w-16' />
          <Skeleton className='min-h-[20rem] w-full' />
        </section>
      </div>
    </PageContent>
  </StandardPageSplit>
)
